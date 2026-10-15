// Chạy bản xuất trên máy chủ studio (box3 có ffmpeg 8): tải nguyên liệu → đo (ffprobe) → dựng lệnh (xuat.ts) → ffmpeg → R2.
// Chạy trong tiến trình Next (chayNen) vì Worker Cloudflare không có ffmpeg; một bản 30s mất ~30–90 giây trên 4 nhân.
import 'server-only';
import { execFile } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { uploadToR2 } from '@/lib/r2';
import { keHoachXuat, urlCanXuat, khoangIm, tiengLa, hinhDung, duoiNhac, NGUONG_IM_LUFS, type NguyenLieu, type LichTieng } from './xuat';
import { sql } from 'drizzle-orm';
import type { Canh, LoaiPhim, Lop, NhanVat, PhanCanh, Tap, ThongTinQc } from './kieu';
import type { Db } from './doc-db';
import { luuKieuChuThuongHieu } from './kho';

const run = promisify(execFile);
const FONT_UNG_VIEN = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf'];

/** Độ to tích hợp (LUFS) của một tệp tiếng — để đưa mọi câu giọng về cùng mức trước khi trộn. */
export async function doLufs(duong: string): Promise<number | null> {
  try {
    const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', duong, '-af', 'ebur128', '-f', 'null', '-'], { timeout: 30_000, maxBuffer: 8 << 20 });
    const m = stderr.match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+)\s*LUFS/); const v = m ? Number(m[1]) : NaN;
    return Number.isFinite(v) ? v : null;
  } catch (e) { console.error('[xuất] đo độ to hỏng — câu này không được chuẩn hoá mức', duong, e); return null; }
}

/** Giây cắt đuôi bài nhạc (đoạn kết nhỏ dần + im) — đo độ to tức thời (duoiNhac), không chỉ bắt im hẳn như silencedetect. */
async function doCatDuoi(duong: string, dai: number | null): Promise<number | null> {
  if (!dai) return null;
  const tep = `${duong}.m128.txt`;
  try {
    await run('ffmpeg', ['-hide_banner', '-nostats', '-i', duong, '-af', `ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=${tep}`, '-f', 'null', '-'], { timeout: 60_000, maxBuffer: 8 << 20 });
    return duoiNhac(await readFile(tep, 'utf8'));
  } catch (e) { console.error('[xuất] đo đuôi nhạc hỏng — nhạc lặp nguyên bài', duong, e); return null; }
}

/** Độ sáng trung bình (Y 0–255) của một clip — 2 khung/giây qua signalstats, lấy trung bình YAVG. Cân màu theo cảnh (xuat.ts › canMauCanh). */
export async function doYavg(duong: string): Promise<number | null> {
  try {
    const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', duong, '-vf', 'fps=2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], { timeout: 60_000, maxBuffer: 8 << 20 });
    const ys = [...stdout.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1])).filter(Number.isFinite);
    return ys.length ? Math.round((ys.reduce((a, b) => a + b, 0) / ys.length) * 10) / 10 : null;
  } catch (e) { console.error('[xuất] đo độ sáng hỏng — clip này không cân màu', duong, e); return null; }
}

async function doTep(duong: string): Promise<{ dai: number | null; coAm: boolean; fps: number | null; lufs?: number | null; catDuoi?: number | null; yavg?: number | null }> {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,r_frame_rate', '-of', 'json', duong], { timeout: 30_000 });
    const j = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type?: string; r_frame_rate?: string }[] };
    const v = (j.streams ?? []).find((s) => s.codec_type === 'video')?.r_frame_rate?.split('/').map(Number);
    const fps = v && v[0] && v[1] ? Math.round((v[0] / v[1]) * 100) / 100 : null;
    const dai = Number(j.format?.duration); const coAm = (j.streams ?? []).some((s) => s.codec_type === 'audio');
    // Mọi tệp có tiếng đều đo độ to — cả clip video (15/10/2026: tiếng cười của clip Grok vào bản xuất ở mức gốc, nhỏ hẳn so với giọng
    // đọc; bản xuất đặt tiếng clip theo giọng như nhạc/hiệu ứng, xuat.ts › LUFS_CLIP_DUOI_GIONG).
    const lufs = coAm ? await doLufs(duong) : null;
    const daiOk = Number.isFinite(dai) && dai > 0 ? dai : null;
    const catDuoi = coAm && !v && (daiOk ?? 0) > 10 ? await doCatDuoi(duong, daiOk) : null;   // chỉ tệp dài (nhạc), câu giọng không cần
    const yavg = v ? await doYavg(duong) : null;   // clip video: độ sáng trung bình để cân màu theo cảnh
    return { dai: daiOk, coAm, fps, lufs, catDuoi, yavg };
  } catch { return { dai: null, coAm: false, fps: null }; }
}

/** canhBao = lệch chuẩn máy tự đo được (khoảng im, lẫn giọng lời dẫn, bản nháp thiếu nhạc) — studio hiện cờ đỏ cạnh bản xuất. */
export type KqXuat = { ok: true; url: string; giay: number; canhThieu: string[]; canhBao: string[] } | { ok: false; loi: string };

/** Ghi một bản xuất thành công vào tập + job — MỘT đường cho nút ⬇ Xuất (actions) và script trên box. Thiếu hình + cờ đỏ máy đo
 *  ghi vào job.loi (job vẫn 'xong') và vào bản xuất (canh_bao) để studio tô đỏ. */
export async function ghiBanXuat(db: Db, o: { tapId: number; job: number; nhanh: string; kq: Extract<KqXuat, { ok: true }> }): Promise<void> {
  const ban = { url: o.kq.url, nhanh: o.nhanh, giay: Math.round(o.kq.giay * 10) / 10, luc: new Date().toISOString(), job: o.job, canh_bao: o.kq.canhBao };
  await db.execute(sql`UPDATE xv_tap SET xuat = coalesce(xuat, '[]'::jsonb) || ${JSON.stringify([ban])}::jsonb, video_url = ${o.kq.url}, updated_at = now() WHERE id = ${o.tapId}`);
  const ghiChu = [...(o.kq.canhThieu.length ? [`thiếu hình: ${o.kq.canhThieu.join(', ')} (bỏ qua)`] : []), ...o.kq.canhBao];
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'xong', output_url = ${o.kq.url}, loi = ${ghiChu.join(' · ')}, updated_at = now() WHERE id = ${o.job}`);
  // Kiểu chữ đang dùng thật của phim → preset thương hiệu trong kho (phim mới cùng shop tự lấy).
  const p = (await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${o.tapId}`)) as unknown as Array<{ phim_id: number }>;
  if (p[0]) await luuKieuChuThuongHieu(db, Number(p[0].phim_id)).catch((e) => console.error('[kho] lưu kiểu chữ hỏng', e));
}

/** Luồng tiếng ngắn hơn luồng hình bao nhiêu giây (bộ lọc trộn dừng sớm → cuối phim câm; máy đo khoảng im không thấy vì chỉ đo phần có tiếng). */
async function tiengNganHon(duong: string): Promise<number | null> {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,duration', '-of', 'json', duong], { timeout: 30_000 });
    const st = (JSON.parse(stdout) as { streams?: { codec_type?: string; duration?: string }[] }).streams ?? [];
    const d = (k: string) => Number(st.find((x) => x.codec_type === k)?.duration);
    return Number.isFinite(d('video')) && Number.isFinite(d('audio')) ? d('video') - d('audio') : null;
  } catch (e) { console.error('[xuất] đo độ dài tiếng/hình hỏng', duong, e); return null; }
}

/** Đo bản vừa xuất (một lượt ebur128): các đoạn ≥0,5s im/đứt nền + tiếng lạ không có trong kịch bản (tiengLa). */
async function doKhoangIm(duong: string, giay: number, thuMuc: string, lich?: LichTieng): Promise<{ im: [number, number][]; la: ReturnType<typeof tiengLa> } | null> {
  const tep = `${thuMuc}/m128.txt`;
  try {
    await run('ffmpeg', ['-hide_banner', '-nostats', '-i', duong, '-vn', '-af', `ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=${tep}`, '-f', 'null', '-'], { timeout: 120_000, maxBuffer: 8 << 20 });
    const md = await readFile(tep, 'utf8');
    return { im: khoangIm(md, giay), la: lich ? tiengLa(md, lich, giay) : [] };
  } catch (e) { console.error('[xuất] đo khoảng im hỏng', e); return null; }
}

/** Đo bản vừa xuất: các đoạn HÌNH ĐỨNG ≥1s (freezedetect) — khung cuối giữ đứng, clip AI tự khựng (anh 15/10/2026 phim #36: "khung cuối tự dưng
 *  bị dừng hẳn lại"). Trả [từ, đến] giây; null = không đo được. */
async function doHinhDung(duong: string, giay: number): Promise<[number, number][] | null> {
  try {
    const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', duong, '-an', '-vf', 'freezedetect=n=0.002:d=1', '-f', 'null', '-'], { timeout: 180_000, maxBuffer: 16 << 20 });
    return hinhDung(stderr, giay);
  } catch (e) { console.error('[xuất] đo hình đứng hỏng', e); return null; }
}

/** Thư mục font chữ màn — MỘT chỗ cho cả bản xuất (libass) lẫn trang xem trước (@font-face /fonts/…): apps/xuong-video/public/fonts (Montserrat, Playfair Display — đều OFL). */
const SFX_DIR = [`${process.cwd()}/public/sfx`, `${process.cwd()}/apps/xuong-video/public/sfx`, '/opt/earns-marketing-os-v2/apps/xuong-video/public/sfx'].find((d) => existsSync(d));
const FONTS_DIR = [`${process.cwd()}/public/fonts`, `${process.cwd()}/apps/xuong-video/public/fonts`, '/opt/earns-marketing-os-v2/apps/xuong-video/public/fonts'].find((d) => existsSync(d));

export async function chayXuat(o: { loai: LoaiPhim; tiLe: string; nhipStopMotion?: boolean; canh: Canh[]; nhanVat: NhanVat[]; tap: Pick<Tap, 'id' | 'nhac_url' | 'nhac_phan_canh'> & { lop?: Lop[]; phan_canh?: Pick<PhanCanh, 'ten' | 'beat'>[] }; qc?: ThongTinQc | null; nhanh?: string | null; chiThuTu?: number[]; choThieuNhac?: boolean }): Promise<KqXuat> {
  const font = FONT_UNG_VIEN.find((f) => existsSync(f));
  if (!font) return { ok: false, loi: 'máy chủ không có font để vẽ chữ (DejaVuSans-Bold)' };
  const thuMuc = `${tmpdir()}/xv-xuat-${o.tap.id}-${randomUUID().slice(0, 8)}`;
  await mkdir(thuMuc, { recursive: true });
  try {
    const urls = urlCanXuat(o.chiThuTu?.length ? o.canh.filter((c) => o.chiThuTu!.includes(c.thu_tu)) : o.canh, o.nhanVat, o.tap, o.nhanh, o.qc);
    const nguyenLieu: NguyenLieu[] = [];
    // Tải song song từng cụm 4 (R2 cùng host, không cần hơn); tệp hỏng thì bỏ qua → shot đó báo thiếu.
    for (let i = 0; i < urls.length; i += 4) {
      await Promise.all(urls.slice(i, i + 4).map(async (url) => {
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
          if (!r.ok) return;
          const duoi = (url.split('?')[0]!.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
          const duong = `${thuMuc}/${nguyenLieu.length}-${randomUUID().slice(0, 6)}.${duoi}`;
          await writeFile(duong, Buffer.from(await r.arrayBuffer()));
          nguyenLieu.push({ url, duong, ...(await doTep(duong)) });
        } catch (e) { console.error('[xuất] tải hỏng', url, e); }
      }));
    }
    const ra = `${thuMuc}/ra.mp4`;
    const kh = keHoachXuat({ ...o, nguyenLieu, font, thuMuc, ra, fontsDir: FONTS_DIR, sfxDir: SFX_DIR });
    if (kh.loi) return { ok: false, loi: kh.loi };
    if (!kh.args.length) return { ok: false, loi: `không shot nào có clip/keyframe tải được${kh.canhThieu.length ? ` (${kh.canhThieu.join(', ')})` : ''}` };
    await Promise.all(kh.tep.map((t) => writeFile(t.duong, t.noiDung, 'utf8')));
    try { await run('ffmpeg', kh.args, { timeout: 15 * 60_000, maxBuffer: 8 << 20 }); }
    catch (e) {
      const err = e as { stderr?: string; message?: string; killed?: boolean; signal?: string };
      // Bị dừng vì quá giờ thì stderr rỗng và message chỉ là nguyên câu lệnh (job 521, 12/10/2026) — nói thẳng lý do.
      if (err.killed || err.signal) return { ok: false, loi: `ffmpeg quá 15 phút, đã dừng (${err.signal ?? 'timeout'}) — dựng quá nặng (nhiều lớp hiệu ứng/phân giải cao?)` };
      return { ok: false, loi: `ffmpeg: ${(err.stderr?.trim() ? err.stderr : err.message || String(e)).trim().split('\n').slice(-3).join(' · ').slice(0, 400)}` };
    }
    const doDo = await doKhoangIm(ra, kh.giay, thuMuc, kh.lich); const im = doDo?.im ?? null;
    const dung = await doHinhDung(ra, kh.giay);
    const ngan = await tiengNganHon(ra);
    const vi = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',');
    const canhBao = [...kh.canhBao, ...(ngan != null && ngan > 0.3 ? [`tiếng ngắn hơn hình ${vi(ngan)}s — cuối phim câm`] : []), ...(im == null ? ['không đo được độ to bản xuất'] : im.length ? [`nền đứt (dưới ${NGUONG_IM_LUFS} LUFS) ở ${im.map(([a, b]) => `${vi(a)}–${vi(b)}s`).join(' · ')}`] : []),
      ...(dung ?? []).map(([a, b]) => `hình đứng ${vi(a)}–${vi(b)}s (${vi(b - a)}s không chuyển động) — clip ngắn hơn giây phát hoặc clip tự khựng`),
      ...(doDo?.la ?? []).map((x) => `tiếng lạ ngoài kịch bản ${vi(x.tu)}–${vi(x.den)}s${x.shot.length ? ` (shot #${x.shot.join(', #')})` : ''}: to hơn nền ${x.hon} dB mà không có giọng / hiệu ứng nào — nghe lại tiếng gốc clip hoặc nhạc`)];
    const buf = await readFile(ra);
    const url = await uploadToR2(`xuong-video/xuat/${o.tap.id}-${o.nhanh || 'thân'}-${randomUUID()}.mp4`, buf, 'video/mp4');
    if (!url) return { ok: false, loi: 'không tải được bản xuất lên R2 (thiếu cấu hình R2)' };
    return { ok: true, url, giay: kh.giay, canhThieu: kh.canhThieu, canhBao };
  } finally {
    await rm(thuMuc, { recursive: true, force: true }).catch(() => {});
  }
}

/** Nối nhiều file giọng (các dòng thoại của một shot) thành MỘT mp3, cách nhau 0,15s — lipsync chỉ nhận một file tiếng. */
export async function gopAm(urls: string[]): Promise<Buffer | null> {
  if (!urls.length) return null;
  const thuMuc = `${tmpdir()}/xv-gop-${randomUUID().slice(0, 8)}`;
  await mkdir(thuMuc, { recursive: true });
  try {
    const tep: string[] = [];
    for (const [i, url] of urls.entries()) {
      const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!r.ok) return null;
      const duong = `${thuMuc}/${i}.bin`; await writeFile(duong, Buffer.from(await r.arrayBuffer())); tep.push(duong);
    }
    const ra = `${thuMuc}/ra.mp3`;
    const loc = `${tep.map((_, i) => `[${i}:a]aformat=sample_rates=44100:channel_layouts=mono,apad=pad_dur=0.15[a${i}]`).join(';')};${tep.map((_, i) => `[a${i}]`).join('')}concat=n=${tep.length}:v=0:a=1[aout]`;
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...tep.flatMap((t) => ['-i', t]), '-filter_complex', loc, '-map', '[aout]', '-c:a', 'libmp3lame', '-q:a', '2', ra], { timeout: 120_000 });
    return await readFile(ra);
  } catch (e) { console.error('[gộp giọng]', e); return null; }
  finally { await rm(thuMuc, { recursive: true, force: true }).catch(() => {}); }
}

/** Khung hình của một video (URL) lấy cách đều nhau, JPEG base64 rộng 360px — cho Claude đọc QC mẫu (phanTichMau). Tối đa `toiDa` khung. */
export async function khungHinhVideo(url: string, toiDa = 40): Promise<{ ok: true; giay: number; khung: { giay: number; b64: string }[] } | { ok: false; loi: string }> {
  const thuMuc = `${tmpdir()}/xv-mau-${randomUUID().slice(0, 8)}`;
  await mkdir(thuMuc, { recursive: true });
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
    if (!r.ok) return { ok: false, loi: `tải video mẫu: HTTP ${r.status}` };
    const tep = `${thuMuc}/goc.mp4`;
    await writeFile(tep, Buffer.from(await r.arrayBuffer()));
    const { dai } = await doTep(tep);
    if (!dai) return { ok: false, loi: 'không đọc được thời lượng video mẫu (không phải mp4?)' };
    const buoc = Math.max(1, Math.ceil(dai / toiDa));
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', tep, '-vf', `fps=1/${buoc},scale=360:-2`, '-q:v', '6', `${thuMuc}/k%03d.jpg`], { timeout: 180_000 });
    const { readdir } = await import('node:fs/promises');
    const ds = (await readdir(thuMuc)).filter((f) => f.startsWith('k') && f.endsWith('.jpg')).sort();
    const khung = await Promise.all(ds.map(async (f, i) => ({ giay: i * buoc, b64: (await readFile(`${thuMuc}/${f}`)).toString('base64') })));
    return { ok: true, giay: Math.round(dai * 10) / 10, khung };
  } catch (e) { return { ok: false, loi: `khung hình mẫu: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` }; }
  finally { await rm(thuMuc, { recursive: true, force: true }).catch(() => {}); }
}
