// PHIM MÁY DỰNG (thể loại 'may_dung' trong danh sách Phim — anh 16/10/2026: "nó luôn phải nằm trong danh sách Phim, chỉ là thể loại khác. Khi mở ra
// cũng phải chia thành các keyframe, card, kịch bản"). Mỗi video = một phim (kinh_thanh.may_dung = đề + chữ đăng) → một tập (kịch bản viết sẵn từ đề)
// → 3 shot (may-dung-do-chu.ts › kichBanMotDung). Xuất: ASS + ffmpeg trên box3 (0đ) → bản xuất của tập (ghiBanXuat, như mọi phim) + keyframe / clip
// từng shot cắt từ chính bản dựng → storyboard, thẻ shot, tab Xuất đi đúng đường của phim. Ảnh nền theo chủ đề = AI (~65–110₫, ghi sổ chi).
// Nguồn đề Front Porch Puzzles = puzzle-books/scripts/de-short.mjs (day-studio.mjs đẩy qua scripts/may-dung.mts --nap); bên đăng (dang-short.mjs)
// đọc danh sách bằng may-dung.mts --ds rồi tải bản xuất mới nhất.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { uploadToR2 } from '../r2';
import { assMotDung, kichBanMotDung, lenhMotDung, DAI, type DeMotDung } from './may-dung-do-chu';
import { sinhAnh } from './google';
import { taoJob, xongJob } from './doc-db';
import { VND_MOI_USD } from './cong-ai';
import type { KinhThanh } from './kieu';
import { MAU_MAY_DUNG, type MauMayDung } from './may-dung-mau';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;
type MayDungKt = NonNullable<KinhThanh['may_dung']>;
const run = promisify(execFile);
const FONTS_DIR = [`${process.cwd()}/public/fonts`, `${process.cwd()}/apps/xuong-video/public/fonts`, '/opt/earns-marketing-os-v2/apps/xuong-video/public/fonts'].find((d) => existsSync(d));

export type DeNap = { du_an: string; mau: MauMayDung; slug: string; chu_de: string; de: DeMotDung; dang: MayDungKt['dang'] };
/** Tên phim: "<Thương hiệu> · Only ONE · <chủ đề> (<từ đích>)" — danh sách gom nhóm theo phần trước " · " (nhom-phim.ts › tenNhomPhim). */
const THUONG_HIEU: Record<string, string> = { 'puzzle-books': 'Front Porch Puzzles' };
const tenPhim = (x: DeNap) => `${THUONG_HIEU[x.du_an] ?? x.du_an} · Only ONE · ${x.chu_de} (${x.de.dich})`;

async function phimTheoSlug(db: Db, slug: string): Promise<{ id: number; tapId: number | null; khuon: MayDungKt } | null> {
  const r = ((await db.execute(sql`SELECT p.id, p.kinh_thanh->'may_dung' AS may_dung, (SELECT t.id FROM xv_tap t WHERE t.phim_id = p.id ORDER BY t.so, t.id LIMIT 1) AS tap_id
    FROM xv_phim p WHERE p.loai = 'may_dung' AND p.kinh_thanh->'may_dung'->>'slug' = ${slug} ORDER BY p.id LIMIT 1`)) as unknown as Row[])[0];
  return r ? { id: Number(r.id), tapId: r.tap_id == null ? null : Number(r.tap_id), khuon: r.may_dung as MayDungKt } : null;
}

/** Ghi tập + 3 shot từ đề (thay toàn bộ shot cũ của tập — shot khuôn do máy sinh, không có gì tay sửa để giữ). */
async function ghiTapShot(db: Db, tapId: number, de: DeMotDung): Promise<void> {
  const kb = kichBanMotDung(de);
  await db.execute(sql`UPDATE xv_tap SET ten = ${'Only ONE · ' + de.dich}, tom_tat = ${kb.tom_tat}, kich_ban = ${kb.kich_ban}, thoi_luong_s = ${DAI}, updated_at = now() WHERE id = ${tapId}`);
  await db.execute(sql`DELETE FROM xv_canh WHERE tap_id = ${tapId}`);
  for (const [i, s] of kb.shots.entries()) {
    await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, hanh_dong_vi, chu_man, thoi_luong_s, phat_s, phan_doan, trang_thai)
      VALUES (${tapId}, ${i + 1}, ${s.canh}, ${s.goc_may}, ${s.hanh_dong}, ${s.hanh_dong}, ${s.chu_man}, ${Math.max(1, Math.round(s.giay))}, ${s.giay}, ${s.canh}, 'nhap')`);
  }
}

/** Nạp / cập nhật đề (khoá = slug): chưa có → tạo phim + tập + 3 shot; đề đổi → ghi lại tập + shot (keyframe / clip cũ hết đúng, xuất lại);
 *  chỉ chữ đăng đổi → cập nhật kinh_thanh. Ảnh nền giữ nguyên qua các lần nạp. */
export async function napDe(db: Db, ds: DeNap[]): Promise<{ moi: number; doi: number; giu: number }> {
  let moi = 0, doi = 0, giu = 0;
  for (const x of ds) {
    if (!MAU_MAY_DUNG[x.mau]) throw new Error(`mẫu Máy Dựng lạ: ${x.mau}`);
    const cu = await phimTheoSlug(db, x.slug);
    const khuon: MayDungKt = { mau: x.mau, du_an: x.du_an, slug: x.slug, chu_de: x.chu_de, de: x.de, dang: x.dang, nen_url: cu?.khuon.nen_url ?? null, nen_prompt: cu?.khuon.nen_prompt ?? null };
    if (!cu) {
      const kt: KinhThanh = { may_dung: khuon, ti_le: '9:16' } as KinhThanh;
      const p = ((await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh) VALUES ('studio', ${tenPhim(x)}, 'may_dung', ${`Đố chữ "Only ONE is spelled right" — ${x.chu_de}. Dựng bằng khuôn, không AI.`}, ${JSON.stringify(kt)}::jsonb) RETURNING id`)) as unknown as Row[])[0]!;
      const t = ((await db.execute(sql`INSERT INTO xv_tap (phim_id, so) VALUES (${Number(p.id)}, 1) RETURNING id`)) as unknown as Row[])[0]!;
      await ghiTapShot(db, Number(t.id), x.de);
      moi++; continue;
    }
    const deDoi = JSON.stringify(cu.khuon.de) !== JSON.stringify(x.de), dangDoi = JSON.stringify(cu.khuon.dang) !== JSON.stringify(x.dang) || cu.khuon.chu_de !== x.chu_de;
    if (!deDoi && !dangDoi && cu.tapId != null) { giu++; continue; }
    await db.execute(sql`UPDATE xv_phim SET ten = ${tenPhim(x)}, kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{may_dung}', ${JSON.stringify(khuon)}::jsonb), updated_at = now() WHERE id = ${cu.id}`);
    let tapId = cu.tapId;
    if (tapId == null) tapId = Number((((await db.execute(sql`INSERT INTO xv_tap (phim_id, so) VALUES (${cu.id}, 1) RETURNING id`)) as unknown as Row[])[0]!).id);
    if (deDoi || cu.tapId == null) await ghiTapShot(db, tapId, x.de);
    doi++;
  }
  return { moi, doi, giu };
}

/** Bản dựng + khung từng shot cho một tập khuôn: MP4 cả video, mỗi shot một keyframe (khung giữa shot) + một clip (cắt đúng đoạn) → R2,
 *  ghi vào xv_canh. Trả kết quả cùng khuôn KqXuat để xuat-tap.ts › ghiBanXuat ghi bản xuất như mọi phim. 0đ. */
export async function xuatMayDungTap(db: Db, tapId: number): Promise<{ ok: true; url: string; giay: number; canhThieu: string[]; canhBao: string[] } | { ok: false; loi: string }> {
  const r = ((await db.execute(sql`SELECT p.kinh_thanh->'may_dung' AS may_dung FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId} AND p.loai = 'may_dung'`)) as unknown as Row[])[0];
  const k = r?.may_dung as MayDungKt | undefined;
  if (!k?.de) return { ok: false, loi: 'tập này không phải phim Máy Dựng (thiếu đề)' };
  if (!FONTS_DIR) return { ok: false, loi: 'máy chủ thiếu thư mục font (apps/xuong-video/public/fonts)' };
  const shots = ((await db.execute(sql`SELECT id, thu_tu FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map((x) => Number(x.id));
  const kb = kichBanMotDung(k.de);
  const thuMuc = `${tmpdir()}/xv-may-dung-${tapId}-${randomUUID().slice(0, 8)}`;
  await mkdir(thuMuc, { recursive: true });
  try {
    let nen: string | null = null;
    if (k.nen_url) {
      const t = await fetch(k.nen_url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
      if (!t?.ok) return { ok: false, loi: `không tải được ảnh nền (${t?.status ?? 'mạng'})` };
      nen = `${thuMuc}/nen.${(k.nen_url.split('?')[0]!.split('.').pop() || 'jpg').slice(0, 4)}`;
      await writeFile(nen, Buffer.from(await t.arrayBuffer()));
    }
    const ass = `${thuMuc}/de.ass`, ra = `${thuMuc}/ra.mp4`;
    await writeFile(ass, assMotDung(k.de), 'utf8');
    try { await run('ffmpeg', lenhMotDung({ de: k.de, ass, nen, fontsDir: FONTS_DIR, ra }), { timeout: 5 * 60_000, maxBuffer: 8 << 20 }); }
    catch (e) { const err = e as { stderr?: string; message?: string }; return { ok: false, loi: `ffmpeg: ${(err.stderr || err.message || String(e)).trim().split('\n').slice(-2).join(' · ').slice(0, 300)}` }; }
    const goc = `xuong-video/may-dung/${k.slug}-${randomUUID().slice(0, 8)}`;
    const url = await uploadToR2(`${goc}.mp4`, await readFile(ra), 'video/mp4');
    if (!url) return { ok: false, loi: 'không đẩy được bản xuất lên R2' };
    const canhBao: string[] = [];
    for (const [i, s] of kb.shots.entries()) {
      const id = shots[i]; if (id == null) { canhBao.push(`tập thiếu shot #${i + 1} — nạp lại đề để dựng lại shot`); continue; }
      const kf = `${thuMuc}/kf${i}.jpg`, clip = `${thuMuc}/c${i}.mp4`;
      try {
        await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(s.tu + (s.den - s.tu) / 2), '-i', ra, '-frames:v', '1', '-q:v', '3', kf], { timeout: 60_000 });
        await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(s.tu), '-i', ra, '-t', String(s.den - s.tu), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart', clip], { timeout: 120_000 });
      } catch (e) { canhBao.push(`shot #${i + 1}: cắt khung hỏng (${(e as Error).message.slice(0, 80)})`); continue; }
      const [uKf, uClip] = await Promise.all([uploadToR2(`${goc}-s${i + 1}.jpg`, await readFile(kf), 'image/jpeg'), uploadToR2(`${goc}-s${i + 1}.mp4`, await readFile(clip), 'video/mp4')]);
      if (!uKf || !uClip) { canhBao.push(`shot #${i + 1}: không đẩy được khung lên R2`); continue; }
      await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${uKf}, keyframe_uv = ${JSON.stringify([uKf])}::jsonb, video_url = ${uClip}, video_cuoi_url = ${uClip}, trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${id}`);
    }
    return { ok: true, url, giay: DAI, canhThieu: [], canhBao };
  } finally { await rm(thuMuc, { recursive: true, force: true }).catch(() => {}); }
}

/** Prompt ảnh nền: cảnh theo chủ đề, KHÔNG chữ (lưới chữ do máy vẽ đè lên), phần giữa thoáng vì bảng trắng che gần hết khung. */
export const promptNen = (chuDe: string, goi: string) =>
  `Vertical 9:16 cozy illustrated background scene for a ${goi.toLowerCase()} themed puzzle video (${chuDe}). Warm, inviting, nostalgic American home atmosphere, `
  + `soft painterly style, rich but gentle colors, subtle depth of field. Decorative details around the edges and corners, calm uncluttered center. `
  + `Absolutely no text, no letters, no words, no numbers, no logos, no watermark.`;

/** Sinh MỘT ảnh nền cho phim Máy Dựng (chuỗi cổng rẻ: ckey ~65–110₫ trước), ghi sổ chi xv_job theo phim. Xong thì xuất lại để nền vào bản dựng. */
export async function sinhNenMayDung(db: Db, phimId: number, prompt?: string): Promise<{ ok: true; url: string; vnd: number | null } | { ok: false; loi: string }> {
  const r = ((await db.execute(sql`SELECT kinh_thanh->'may_dung' AS may_dung FROM xv_phim WHERE id = ${phimId} AND loai = 'may_dung'`)) as unknown as Row[])[0];
  const k = r?.may_dung as MayDungKt | undefined;
  if (!k?.de) return { ok: false, loi: 'không phải phim Máy Dựng' };
  const p = (prompt ?? '').trim() || promptNen(k.chu_de, k.de.goi);
  const job = await taoJob(db, { phim_id: phimId, nhan: `Nền Máy Dựng · ${k.chu_de}`, loai: 'anh', provider: 'ckey', model: 'gemini-nano-banana-2.1', request: { dich: 'may_dung_nen', prompt: p }, cents: 0.5 });
  const kq = await sinhAnh({ model: 'gemini-nano-banana-2.1', prompt: p, tiLe: '9:16' });
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return { ok: false, loi: kq.loi }; }
  const url = await uploadToR2(`xuong-video/may-dung-nen/${k.slug}-${Date.now()}.${kq.mimeType.includes('png') ? 'png' : 'jpg'}`, kq.data, kq.mimeType);
  if (!url) { await xongJob(db, job, { loi: 'không đẩy được ảnh nền lên R2' }); return { ok: false, loi: 'không đẩy được ảnh nền lên R2' }; }
  const vnd = kq.nguon?.vnd ?? null, cents = vnd != null ? (vnd / VND_MOI_USD) * 100 : (kq.nguon?.cents ?? 0.5);
  await xongJob(db, job, { output_url: url, model: kq.nguon ? `${kq.nguon.cong}:${kq.nguon.model}` : kq.model, chi_phi_cents: cents });
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(jsonb_set(kinh_thanh, '{may_dung,nen_url}', ${JSON.stringify(url)}::jsonb), '{may_dung,nen_prompt}', ${JSON.stringify(p)}::jsonb), updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, url, vnd };
}

/** Danh sách cho bên đăng: { slug: { phim_id, tap_id, file_url (bản xuất mới nhất), xuat_luc, nen, ...chữ đăng } } của một dự án. */
export async function dsMayDungDang(db: Db, duAn: string): Promise<Record<string, Row>> {
  const rows = (await db.execute(sql`SELECT p.id, p.kinh_thanh->'may_dung' AS may_dung, t.id AS tap_id, t.video_url, t.xuat->-1->>'luc' AS xuat_luc
    FROM xv_phim p LEFT JOIN LATERAL (SELECT * FROM xv_tap WHERE phim_id = p.id ORDER BY so, id LIMIT 1) t ON true
    WHERE p.loai = 'may_dung' AND p.kinh_thanh->'may_dung'->>'du_an' = ${duAn} AND coalesce((p.kinh_thanh->>'luu_tru')::boolean, false) = false`)) as unknown as Row[];
  const ra: Record<string, Row> = {};
  for (const r of rows) { const k = r.may_dung as MayDungKt; ra[k.slug] = { phim_id: Number(r.id), tap_id: r.tap_id == null ? null : Number(r.tap_id), file_url: r.video_url ?? null, xuat_luc: r.xuat_luc ?? null, nen: !!k.nen_url, ...k.dang, kieu: 'an', mau: k.mau }; }
  return ra;
}
