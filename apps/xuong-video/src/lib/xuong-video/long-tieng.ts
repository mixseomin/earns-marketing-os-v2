// Máy chủ của BẢN LỒNG TIẾNG (ban-dich.ts): dịch chữ màn + lời (1 lượt Claude, nhớ theo nội dung) → đọc từng câu bằng đúng giọng của bản gốc
// (ElevenLabs, tính vào ký tự trong gói; câu đã đọc thì dùng lại) → xuất MP4 + tách track tiếng M4A (gắn vào video gốc trên YouTube)
// → ghi vào danh sách bản xuất của tập, KHÔNG thay bản chính (video_url giữ nguyên). Một chỗ cho nút (actions.ts) và script.
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { uploadToR2 } from '@/lib/r2';
import { dichChuoi } from './claude';
import { chuoiCanDich, ganDich, theoNgonNgu, giongDong } from './ban-dich';
import { chayXuat } from './xuat-chay';
import { gonGiong } from './hau-ky';
import { chayViecAm } from './viec-am';
import { dauVaoGiongTheoModel } from './giong';
import { MODEL_GIONG_MAC_DINH, giongMacDinh } from './sinh-giong';
import { docKinhThanh, locNhanh, type BanXuat } from './kieu';
import { boiCanhTap, mapCanh, ghiTienChu, xongJob, type Db, type Row } from './doc-db';

const run = promisify(execFile);
const bam = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24);
const PUB = () => (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, '');
/** Tệp R2 có khoá suy từ nội dung (không bao giờ đổi) → có rồi thì dùng lại, khỏi tiêu tiền lần hai. */
async function coTep(key: string): Promise<string | null> {
  const url = `${PUB()}/${key}`;
  try { return (await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) })).ok ? url : null; } catch { return null; }
}

/** Dịch có nhớ: cùng bộ câu + cùng ngôn ngữ = đọc bản dịch đã lưu (0đ). */
async function dichCoNho(db: Db, o: { kt: unknown; phimId: number; tapSo: number; sang: string; ds: string[] }): Promise<{ ok: true; dich: Map<string, string>; moi: boolean } | { ok: false; loi: string }> {
  const key = `xuong-video/dich/${o.sang}-${bam(JSON.stringify(o.ds))}.json`;
  const cu = await coTep(key);
  if (cu) { const j = (await (await fetch(cu)).json()) as Record<string, string>; return { ok: true, dich: new Map(Object.entries(j)), moi: false }; }
  const kq = await dichChuoi({ kinhThanh: o.kt as never, sang: o.sang, ds: o.ds, thuatNgu: [] });
  if (!kq.ok) return kq;
  await ghiTienChu(db, o.phimId, `Dịch lồng tiếng ${o.sang} · tập ${o.tapSo}`, kq.model, kq.tokens);
  const dich = new Map(o.ds.map((x, i) => [x, kq.data[i] ?? x] as const));
  await uploadToR2(key, Buffer.from(JSON.stringify(Object.fromEntries(dich))), 'application/json');
  return { ok: true, dich, moi: true };
}

/** Tách track tiếng của bản MP4 (AAC, không mã lại) → M4A trên R2. */
async function tachTrackTieng(mp4: string, ten: string): Promise<string | null> {
  const thu = `${tmpdir()}/xv-lt-${randomUUID()}`; await mkdir(thu, { recursive: true });
  try {
    const r = await fetch(mp4); if (!r.ok) return null;
    await writeFile(`${thu}/v.mp4`, Buffer.from(await r.arrayBuffer()));
    await run('ffmpeg', ['-v', 'error', '-y', '-i', `${thu}/v.mp4`, '-vn', '-c:a', 'copy', `${thu}/a.m4a`], { timeout: 120_000 });
    return await uploadToR2(`xuong-video/xuat/${ten}-${randomUUID()}.m4a`, await readFile(`${thu}/a.m4a`), 'audio/mp4');
  } catch (e) { console.error('[lồng tiếng] tách track tiếng hỏng', e); return null; }
  finally { await rm(thu, { recursive: true, force: true }); }
}

/** khongDich = thử đường dựng 0đ: không gọi Claude, không đọc giọng mới (dùng câu + file giọng gốc); không ghi vào danh sách bản xuất. */
export async function xuatLongTiengTap(db: Db, tapId: number, job: number, sang = 'vi', khongDich = false): Promise<{ ok: true; url: string } | { ok: false; loi: string }> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return { ok: false, loi: 'không thấy tập' };
  const kt = docKinhThanh(bc.kt);
  if ((kt.ngon_ngu ?? 'vi') === sang) return { ok: false, loi: `phim đã là tiếng ${sang} — xuất bản thường là đủ` };
  const canh = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  if (!canh.length) return { ok: false, loi: 'tập chưa có shot' };
  const ds = chuoiCanDich(canh);
  let dich = new Map<string, string>();
  if (ds.length && !khongDich) {
    const d = await dichCoNho(db, { kt: bc.kt, phimId: bc.tap.phim_id, tapSo: bc.tap.so, sang, ds });
    if (!d.ok) return d;
    dich = d.dich;
  }
  // Đọc từng câu bằng giọng của bản gốc. Dòng đã có bản dịch còn mới (cùng câu gốc, cùng câu dịch, có file) thì giữ, không đọc lại. Khoá file = băm (model, giọng, diễn xuất, câu) → câu đã đọc ở lượt trước dùng lại, 0 ký tự.
  const giongDich = new Map<string, string>(); let kyTu = 0; const loiGiong: string[] = [];
  for (const c of canh) for (const [i, d] of (c.thoai ?? []).entries()) {
    if (!d.loi.trim()) continue;
    if (khongDich) { if (d.url) giongDich.set(`${c.id}:${i}`, d.url); continue; }
    const text = dich.get(d.loi.trim()) ?? d.loi.trim();
    const cu = d.dich?.[sang];
    if (cu?.url && cu.goc === d.loi && cu.loi === text) { giongDich.set(`${c.id}:${i}`, cu.url); continue; }
    const g = giongDong(d, bc.nhanVat, kt) ?? await (async () => { const m = MODEL_GIONG_MAC_DINH(); return { model: m, voice: await giongMacDinh(m) }; })();
    const camXuc = c.cam_xuc;
    const loiDoc = d.dien_xuat && /eleven/.test(g.model) && /v3/.test(g.model) ? `[${d.dien_xuat}] ${text}` : text;
    const key = `xuong-video/am/long-tieng/${sang}-${bam(JSON.stringify([g.model, g.voice, loiDoc, camXuc]))}.mp3`;
    let url = await coTep(key);
    if (!url) {
      const kq = await chayViecAm({ kieu: 'am', job, model: g.model, input: await dauVaoGiongTheoModel(g.model, { text: loiDoc, voice: g.voice, ngonNgu: sang, camXuc, theLoai: kt.the_loai ?? '' }), thuMuc: `long-tieng/${c.id}-${i}` });
      if (!kq.ok) { loiGiong.push(`#${c.thu_tu} dòng ${i + 1}: ${kq.loi}`); continue; }
      kyTu += loiDoc.length;
      // Gọn (cắt lặng đầu/cuối) như giọng gốc rồi lưu ở khoá nội dung để lần sau dùng lại.
      const gon = await gonGiong(kq.url, c.id) ?? kq.url;
      const r = await fetch(gon);
      url = r.ok ? await uploadToR2(key, Buffer.from(await r.arrayBuffer()), 'audio/mpeg') ?? gon : gon;
    }
    giongDich.set(`${c.id}:${i}`, url);
  }
  if (loiGiong.length && !giongDich.size) return { ok: false, loi: `không đọc được câu nào: ${loiGiong[0]}` };
  // Lưu bản dịch vào từng shot (chu_man_dich + thoai[i].dich) — timeline xem được bản tiếng này (nút EN | 🇻🇳) mà không xuất lại.
  // Ghi từng dòng bằng jsonb_set (không ghi đè cả mảng thoai: job giọng gốc có thể đang ghi vào dòng khác cùng lúc).
  const daGan = ganDich(canh, sang, dich, giongDich);
  if (!khongDich) for (const c of daGan) {
    const cm = c.chu_man_dich?.[sang];
    if (cm) await db.execute(sql`UPDATE xv_canh SET chu_man_dich = coalesce(chu_man_dich, '{}'::jsonb) || jsonb_build_object(${sang}::text, ${JSON.stringify(cm)}::jsonb) WHERE id = ${c.id}`);
    for (const [i, d] of c.thoai.entries()) {
      const x = d.dich?.[sang]; if (!x) continue;
      await db.execute(sql`UPDATE xv_canh SET thoai = jsonb_set(thoai, ${`{${i},dich}`}::text[], coalesce(thoai->${i}->'dich', '{}'::jsonb) || jsonb_build_object(${sang}::text, ${JSON.stringify(x)}::jsonb))
        WHERE id = ${c.id} AND thoai->${i}->>'loi' = ${x.goc}`);
    }
  }
  const canhDich = theoNgonNgu(daGan, sang).canh;
  const kq = await chayXuat({ loai: bc.loai, tiLe: kt.ti_le, canh: canhDich, nhanVat: bc.nhanVat, tap: bc.tap, qc: kt.qc, nhanh: null, choThieuNhac: true });
  if (!kq.ok) return kq;
  const amUrl = await tachTrackTieng(kq.url, `${tapId}-${sang}`);
  const canhBao = [...(loiGiong.length ? [`${loiGiong.length} câu không đọc được (im): ${loiGiong.join(' · ').slice(0, 300)}`] : []), ...(amUrl ? [] : ['không tách được track tiếng M4A']), ...kq.canhBao];
  const ban: BanXuat = { url: kq.url, nhanh: '', long_tieng: sang, ...(amUrl ? { am_url: amUrl } : {}), giay: Math.round(kq.giay * 10) / 10, luc: new Date().toISOString(), job, canh_bao: canhBao };
  // Bản thử 0đ (tiếng gốc) không vào 'Đã xuất' — nó mang nhãn lồng tiếng mà tiếng vẫn là bản gốc, dễ mở nhầm.
  if (!khongDich) await db.execute(sql`UPDATE xv_tap SET xuat = coalesce(xuat, '[]'::jsonb) || ${JSON.stringify([ban])}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  await xongJob(db, job, { output_url: kq.url });
  if (kyTu) console.log(`[lồng tiếng] tập ${tapId}: đọc mới ${kyTu} ký tự (gói ElevenLabs)`);
  return { ok: true, url: kq.url };
}
