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
import { keHoachXuat, urlCanXuat, type NguyenLieu } from './xuat';
import type { Canh, LoaiPhim, NhanVat, Tap, ThongTinQc } from './kieu';

const run = promisify(execFile);
const FONT_UNG_VIEN = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf'];

async function doTep(duong: string): Promise<{ dai: number | null; coAm: boolean }> {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', duong], { timeout: 30_000 });
    const j = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type?: string }[] };
    const dai = Number(j.format?.duration); return { dai: Number.isFinite(dai) && dai > 0 ? dai : null, coAm: (j.streams ?? []).some((s) => s.codec_type === 'audio') };
  } catch { return { dai: null, coAm: false }; }
}

export type KqXuat = { ok: true; url: string; giay: number; canhThieu: string[] } | { ok: false; loi: string };

/** Thư mục font chữ màn — MỘT chỗ cho cả bản xuất (libass) lẫn trang xem trước (@font-face /fonts/…): apps/xuong-video/public/fonts (Montserrat, OFL). */
const FONTS_DIR = [`${process.cwd()}/public/fonts`, `${process.cwd()}/apps/xuong-video/public/fonts`, '/opt/earns-marketing-os-v2/apps/xuong-video/public/fonts'].find((d) => existsSync(d));

export async function chayXuat(o: { loai: LoaiPhim; tiLe: string; canh: Canh[]; nhanVat: NhanVat[]; tap: Pick<Tap, 'id' | 'nhac_url' | 'nhac_phan_canh'>; qc?: ThongTinQc | null; nhanh?: string | null; chiThuTu?: number[] }): Promise<KqXuat> {
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
    const kh = keHoachXuat({ ...o, nguyenLieu, font, thuMuc, ra, fontsDir: FONTS_DIR });
    if (!kh.args.length) return { ok: false, loi: `không shot nào có clip/keyframe tải được${kh.canhThieu.length ? ` (${kh.canhThieu.join(', ')})` : ''}` };
    await Promise.all(kh.tep.map((t) => writeFile(t.duong, t.noiDung, 'utf8')));
    try { await run('ffmpeg', kh.args, { timeout: 15 * 60_000, maxBuffer: 8 << 20 }); }
    catch (e) { const err = e as { stderr?: string; message?: string }; return { ok: false, loi: `ffmpeg: ${(err.stderr || err.message || String(e)).trim().split('\n').slice(-3).join(' · ').slice(0, 400)}` }; }
    const buf = await readFile(ra);
    const url = await uploadToR2(`xuong-video/xuat/${o.tap.id}-${o.nhanh || 'thân'}-${randomUUID()}.mp4`, buf, 'video/mp4');
    if (!url) return { ok: false, loi: 'không tải được bản xuất lên R2 (thiếu cấu hình R2)' };
    return { ok: true, url, giay: kh.giay, canhThieu: kh.canhThieu };
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
