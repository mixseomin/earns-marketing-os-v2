// MÁY → VIDEO (anh 17/10/2026, duyệt bố cục "Tự động · Theo template · Làm tự do"). Một MÁY = mẫu dựng + nguồn đề + luật chọn + nơi đăng;
// mỗi VIDEO là một dòng nhẹ của xv_may_video (đề, video, 3 khung, sổ đăng từng nền) — không phim / tập / shot riêng, nên lên số lớn được.
// Cửa vào cho máy ngoài studio: scripts/may-dung.mts (puzzle-books qua ssh: nạp đề, xuất, đọc danh sách đăng, ghi sổ đăng, ghi số nguồn).
import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { catAnhTuVideo, dungVideo } from './may-dung';
import { BO_DUNG, truyVanAnhMau, type DeMay } from './mau-dung';
import { idPexels, idPexelsVideo, timAnhNen, timVideoNen } from './anh-nen';
import { MAU_MAY_DUNG, type MauMayDung } from './may-dung-mau';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;

/** Cấu hình kênh cho máy đăng bằng br (puzzle-books scripts/dang-br.mjs): profile br + id vault, và chỗ nhận diện kênh trên nền. */
export type KenhBr = { profile: string; acct: string; page_id?: string; ten?: string; handle?: string; kenh_id?: string; api?: boolean; graph_id?: string };
export type NenDang = { nen: string; ten: string; tk: string; gio: string; tran: number; kem: string; may: string; br?: KenhBr };
export type DaDang = { url: string; ngay: string; luc?: string; binhLuan?: boolean };
export type May = {
  id: number; ma: string; ten: string; du_an: string; muc_dich: string; mau: MauMayDung; chay: boolean;
  nguon: { mo_ta?: string; dung?: number; tong?: number }; luat: string[]; dang: NenDang[];
  so: { video: number; cho_dang: number; luu_tru: number };
};
export type VideoMay = {
  id: number; slug: string; chu_de: string; de: DeMay; dang: { title?: string; description?: string; link?: string; book?: string; words?: string[] };
  /** mẫu dựng riêng (NULL = mẫu của máy) */ mau: MauMayDung | null; video_url: string | null; khung: string[]; /** ảnh tĩnh cho bài ảnh (nền x_anh) */ anh: string[]; giay: number | null; xuat_luc: string | null; da_dang: Record<string, DaDang>; luu_tru: boolean; created_at: string;
};
/** nen_url: ảnh nền của video (mẫu có nền ảnh thật — luật 'nền lớn = ảnh thật'); đổi ảnh = dựng lại như đổi đề.
 *  KHÔNG gửi trường này (undefined) = giữ nguyên ảnh nền đang có — máy cũ (Front Porch) nạp đề không kèm ảnh, không được xoá ảnh của nó. */
/** mau: mẫu dựng riêng của video (bước 3 Dạng × Góc × Sản phẩm, 26/10/2026 — một máy nhiều dạng); bỏ trống = mẫu của máy. Đổi mẫu = đổi đề (dựng lại). */
export type DeNapMay = { slug: string; chu_de: string; de: DeMay; dang: VideoMay['dang']; nen_url?: string | null; mau?: MauMayDung | null };
/** Một bước máy đã làm (xv_may_nhat_ky): chon_de · trang_tang · dung · dang · bo_qua · loi. */
export type NhatKy = { id: number; luc: string; buoc: string; ok: boolean; slug: string | null; nen: string | null; noi_dung: string; url: string | null };
/** Lượt đăng gần nhất của một nền — tệp báo lượt dang-short.mjs ghi cho cty.on.tc (/var/lib/cty/may/video-<nền>.json, cùng box). */
export type LuotDang = { nen: string; luc: string; ok: boolean; slug?: string; url?: string; loi?: string; kho?: number; ke?: string | null };
const BAO_CTY = '/var/lib/cty/may';

const COT_MAY = sql`m.id, m.ma, m.ten, m.du_an, m.muc_dich, m.mau, m.chay, m.nguon, m.luat, m.dang,
  (SELECT count(*)::int FROM xv_may_video v WHERE v.may_id = m.id AND NOT v.luu_tru) AS so_video,
  (SELECT count(*)::int FROM xv_may_video v WHERE v.may_id = m.id AND NOT v.luu_tru AND v.video_url IS NOT NULL
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(m.dang) d WHERE NOT (v.da_dang ? (d->>'nen')))) AS so_cho,
  (SELECT count(*)::int FROM xv_may_video v WHERE v.may_id = m.id AND v.luu_tru) AS so_luu`;
const mapMay = (r: Row): May => ({
  id: Number(r.id), ma: String(r.ma), ten: String(r.ten), du_an: String(r.du_an), muc_dich: String(r.muc_dich ?? ''), mau: r.mau as MauMayDung, chay: !!r.chay,
  nguon: (r.nguon ?? {}) as May['nguon'], luat: (r.luat ?? []) as string[], dang: (r.dang ?? []) as NenDang[],
  so: { video: Number(r.so_video ?? 0), cho_dang: Number(r.so_cho ?? 0), luu_tru: Number(r.so_luu ?? 0) },
});
const mapVideo = (r: Row): VideoMay => ({
  id: Number(r.id), slug: String(r.slug), chu_de: String(r.chu_de ?? ''), de: r.de as DeMay, dang: (r.dang ?? {}) as VideoMay['dang'], mau: (r.mau as MauMayDung | null) ?? null,
  video_url: (r.video_url as string | null) ?? null, khung: (r.khung ?? []) as string[], anh: (r.anh ?? []) as string[], giay: r.giay == null ? null : Number(r.giay),
  xuat_luc: r.xuat_luc == null ? null : String(r.xuat_luc), da_dang: (r.da_dang ?? {}) as Record<string, DaDang>, luu_tru: !!r.luu_tru, created_at: String(r.created_at),
});

export async function dsMay(db: Db): Promise<May[]> {
  return ((await db.execute(sql`SELECT ${COT_MAY} FROM xv_may m ORDER BY m.muc_dich, m.id`)) as unknown as Row[]).map(mapMay);
}
export async function mayTheoMa(db: Db, ma: string): Promise<May | null> {
  const r = ((await db.execute(sql`SELECT ${COT_MAY} FROM xv_may m WHERE m.ma = ${ma}`)) as unknown as Row[])[0];
  return r ? mapMay(r) : null;
}
/** Một máy + video mới nhất trước: mặc định chỉ video đang dùng (`luuTru` = cả lưu trữ), `gioiHan` dòng. */
export async function chiTietMay(db: Db, id: number, o: { luuTru?: boolean; gioiHan?: number } = {}): Promise<{ may: May; video: VideoMay[]; nhat_ky: NhatKy[]; luot: LuotDang[] } | null> {
  const r = ((await db.execute(sql`SELECT ${COT_MAY} FROM xv_may m WHERE m.id = ${id}`)) as unknown as Row[])[0];
  if (!r) return null;
  const v = (await db.execute(sql`SELECT * FROM xv_may_video WHERE may_id = ${id} AND (${!!o.luuTru} OR NOT luu_tru) ORDER BY luu_tru, id DESC LIMIT ${o.gioiHan ?? 15}`)) as unknown as Row[];
  const nk = (await db.execute(sql`SELECT id, luc, buoc, ok, slug, nen, noi_dung, url FROM xv_may_nhat_ky WHERE may_id = ${id} ORDER BY luc DESC, id DESC LIMIT 12`)) as unknown as Row[];
  const may = mapMay(r);
  const luot = (await Promise.all(may.dang.map(async (d) => { try { return { nen: d.nen, ...JSON.parse(await readFile(`${BAO_CTY}/video-${d.nen}.json`, 'utf8')) } as LuotDang; } catch { return null; } }))).filter((x): x is LuotDang => !!x);
  return { may, video: v.map(mapVideo), luot,
    nhat_ky: nk.map((x) => ({ id: Number(x.id), luc: String(x.luc), buoc: String(x.buoc), ok: !!x.ok, slug: (x.slug as string | null) ?? null, nen: (x.nen as string | null) ?? null, noi_dung: String(x.noi_dung ?? ''), url: (x.url as string | null) ?? null })) };
}
/** Ghi một bước máy vừa làm vào nhật ký (máy ngoài gọi qua may-dung.mts --nhat-ky). */
export async function ghiNhatKy(db: Db, ma: string, x: { buoc: string; ok?: boolean; slug?: string; nen?: string; noi_dung?: string; url?: string }): Promise<void> {
  await db.execute(sql`INSERT INTO xv_may_nhat_ky (may_id, buoc, ok, slug, nen, noi_dung, url) SELECT id, ${x.buoc}, ${x.ok ?? true}, ${x.slug ?? null}, ${x.nen ?? null}, ${x.noi_dung ?? ''}, ${x.url ?? null} FROM xv_may WHERE ma = ${ma}`);
}

/** JSON không phụ thuộc thứ tự khoá — jsonb của Postgres tự xếp lại khoá, so JSON.stringify thô thì mọi lần nạp đều thành "đề đổi" và xoá bản xuất
 *  (đo 18/10/2026: chỉ đổi tiêu đề mà 30 video Hotel mất bản xuất). */
export const jsonChuan = (x: unknown): string => JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]])) : v));
/** Nạp đề (khoá = slug trong máy): chưa có → thêm; đề đổi → ghi đề mới, bỏ video cũ (xuất lại); chỉ chữ đăng đổi → cập nhật chữ. */
export async function napVideo(db: Db, ma: string, ds: DeNapMay[]): Promise<{ moi: number; doi: number; giu: number }> {
  const m = await mayTheoMa(db, ma); if (!m) throw new Error(`không có máy "${ma}"`);
  if (!MAU_MAY_DUNG[m.mau]) throw new Error(`máy ${ma}: mẫu lạ ${m.mau}`);
  let moi = 0, doi = 0, giu = 0;
  for (const x of ds) {
    const cu = ((await db.execute(sql`SELECT id, de, dang, chu_de, nen_url, mau FROM xv_may_video WHERE may_id = ${m.id} AND slug = ${x.slug}`)) as unknown as Row[])[0];
    const coNen = x.nen_url !== undefined, nen = coNen ? x.nen_url ?? null : ((cu?.nen_url as string | null | undefined) ?? null);
    if (x.mau && !MAU_MAY_DUNG[x.mau]) throw new Error(`${x.slug}: mẫu lạ ${x.mau}`);
    const mau = x.mau !== undefined ? x.mau ?? null : ((cu?.mau as MauMayDung | null | undefined) ?? null);   // không gửi = giữ mẫu đang có
    if (!cu) {
      await db.execute(sql`INSERT INTO xv_may_video (may_id, slug, chu_de, de, dang, nen_url, mau) VALUES (${m.id}, ${x.slug}, ${x.chu_de}, ${JSON.stringify(x.de)}::jsonb, ${JSON.stringify(x.dang)}::jsonb, ${nen}, ${mau})`);
      moi++; continue;
    }
    const deDoi = jsonChuan(cu.de) !== jsonChuan(x.de) || (coNen && (cu.nen_url ?? null) !== nen) || ((cu.mau ?? null) !== mau), chuDoi = jsonChuan(cu.dang) !== jsonChuan(x.dang) || cu.chu_de !== x.chu_de;
    if (!deDoi && !chuDoi) { giu++; continue; }
    if (deDoi) await db.execute(sql`UPDATE xv_may_video SET de = ${JSON.stringify(x.de)}::jsonb, dang = ${JSON.stringify(x.dang)}::jsonb, chu_de = ${x.chu_de}, nen_url = ${nen}, mau = ${mau}, video_url = NULL, khung = '[]'::jsonb, anh = '[]'::jsonb, xuat_luc = NULL, updated_at = now() WHERE id = ${Number(cu.id)}`);
    else await db.execute(sql`UPDATE xv_may_video SET dang = ${JSON.stringify(x.dang)}::jsonb, chu_de = ${x.chu_de}, updated_at = now() WHERE id = ${Number(cu.id)}`);
    doi++;
  }
  return { moi, doi, giu };
}

/** Dựng video của một dòng (0đ) → video_url + 3 khung. */
export async function xuatVideo(db: Db, videoId: number): Promise<{ ok: true; url: string } | { ok: false; loi: string }> {
  const r = ((await db.execute(sql`SELECT v.slug, v.de, v.nen_url, v.chu_de, v.may_id, coalesce(v.mau, m.mau) AS mau FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE v.id = ${videoId}`)) as unknown as Row[])[0];
  if (!r) return { ok: false, loi: `không có video #${videoId}` };
  const nenVideo = !!BO_DUNG[r.mau as MauMayDung]?.nenVideo;   // mẫu nền video (canh-dong): tìm VIDEO Pexels, so trùng theo id video
  // chưa có ảnh nền → tự lấy ảnh thật Pexels theo chủ đề, không trùng trong máy (luật anh 18/10/2026: mọi bài đăng có ảnh minh hoạ thật; anh-nen.ts)
  if (!r.nen_url) {
    const daDung = new Set(((await db.execute(sql`SELECT nen_url FROM xv_may_video WHERE may_id = ${Number(r.may_id)} AND nen_url IS NOT NULL`)) as unknown as Row[]).map((x) => (nenVideo ? idPexelsVideo : idPexels)(x.nen_url as string)).filter((x): x is number => x != null));
    // de.truy: dòng tự khai từ khoá ảnh (bài link — mỗi bài một ảnh riêng, anh 21/10/2026 "bài phải đa dạng không thành spam"); không có thì theo mẫu
    try { r.nen_url = await (nenVideo ? timVideoNen : timAnhNen)((r.de as { truy?: string } | null)?.truy ?? truyVanAnhMau(r.mau as MauMayDung, r.de as DeMay, String(r.chu_de ?? '')), daDung); }
    catch (e) { return { ok: false, loi: `ảnh nền: ${(e as Error).message}` }; }
    await db.execute(sql`UPDATE xv_may_video SET nen_url = ${r.nen_url as string}, updated_at = now() WHERE id = ${videoId}`);
  }
  // BÀI LINK (S03 bước 4, anh chọn 21/10/2026): dòng không có video — bài FB / X dẫn về trang đích, ảnh = ảnh thật nen_url (cũng là ảnh của trang đích).
  // "Xuất" = chốt bản (xuat_luc) để Phòng Nội dung chấm đúng bản, anh = [nen_url]; không dựng ffmpeg.
  if ((r.de as { loai?: string } | null)?.loai === 'bai-link') {
    await db.execute(sql`UPDATE xv_may_video SET video_url = NULL, khung = '[]'::jsonb, anh = ${JSON.stringify([r.nen_url])}::jsonb, giay = NULL, xuat_luc = now(), updated_at = now() WHERE id = ${videoId}`);
    return { ok: true, url: String(r.nen_url) };
  }
  const v = await dungVideo({ mau: r.mau as MauMayDung, de: r.de as DeMay, nenUrl: (r.nen_url as string | null) ?? null, slug: String(r.slug) });
  if (!v.ok) return v;
  await db.execute(sql`UPDATE xv_may_video SET video_url = ${v.url}, khung = ${JSON.stringify(v.khung)}::jsonb, anh = ${JSON.stringify(v.anh)}::jsonb, giay = ${v.giay}, xuat_luc = now(), updated_at = now() WHERE id = ${videoId}`);
  return { ok: true, url: v.url };
}

/** Bù ảnh tĩnh cho video đã dựng mà chưa có (mẫu mới khai `anh`) — không dựng lại video. */
export async function bucAnh(db: Db, videoId: number): Promise<{ ok: true; so: number } | { ok: false; loi: string }> {
  const r = ((await db.execute(sql`SELECT v.slug, v.de, v.video_url, coalesce(v.mau, m.mau) AS mau FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE v.id = ${videoId}`)) as unknown as Row[])[0];
  if (!r?.video_url) return { ok: false, loi: `video #${videoId} chưa dựng` };
  const k = await catAnhTuVideo({ mau: r.mau as MauMayDung, de: r.de as DeMay, videoUrl: String(r.video_url), slug: String(r.slug) });
  if (!k.ok) return k;
  await db.execute(sql`UPDATE xv_may_video SET anh = ${JSON.stringify(k.anh)}::jsonb, updated_at = now() WHERE id = ${videoId}`);
  return { ok: true, so: k.anh.length };
}

/** Danh sách cho bên đăng / bên đọc số: { slug: { id, file_url, xuat_luc, da_dang, ...chữ đăng } }. Mặc định bỏ video lưu trữ. */
export async function dsVideoDang(db: Db, ma: string, caLuuTru = false): Promise<Record<string, Row>> {
  const m = await mayTheoMa(db, ma); if (!m) throw new Error(`không có máy "${ma}"`);
  // duyet: Phòng Nội dung đã DUYỆT đúng bản xuất + đúng chữ đăng này (cham.xuat = xuat_luc, cham.dang = md5(dang) — xuất lại / sửa chữ là phải chấm lại; apps/cty/worker/cham-dang.mjs). Máy đăng chỉ lấy video duyet.
  const rows = (await db.execute(sql`SELECT *, (cham->>'ket' = 'DUYET' AND cham->>'xuat' = xuat_luc::text AND cham->>'dang' = md5(dang::text)) AS duyet FROM xv_may_video WHERE may_id = ${m.id} AND (${caLuuTru} OR NOT luu_tru) ORDER BY id`)) as unknown as Row[];
  return Object.fromEntries(rows.map((r) => { const v = mapVideo(r); return [v.slug, { id: v.id, file_url: v.video_url, anh: v.anh, xuat_luc: v.xuat_luc, da_dang: v.da_dang, luu_tru: v.luu_tru, duyet: !!r.duyet, cham: r.cham ?? null, ...v.dang, kieu: 'an', mau: m.mau }]; }));
}
/** Sổ đăng: ghi (hoặc gộp thêm trường, vd binhLuan) lượt đăng của một video lên một nền. Slug lạ → false. */
export async function ghiDang(db: Db, ma: string, slug: string, nen: string, x: Partial<DaDang>): Promise<boolean> {
  const r = (await db.execute(sql`UPDATE xv_may_video v SET da_dang = jsonb_set(v.da_dang, ${`{${nen}}`}::text[], coalesce(v.da_dang->${nen}, '{}'::jsonb) || ${JSON.stringify(x)}::jsonb), updated_at = now()
    FROM xv_may m WHERE m.id = v.may_id AND m.ma = ${ma} AND v.slug = ${slug} RETURNING v.id`)) as unknown as Row[];
  return r.length > 0;
}
/** Số của nguồn đề (máy nguồn tự đếm rồi ghi: đã dùng / tổng). */
export async function ghiNguon(db: Db, ma: string, nguon: May['nguon']): Promise<void> {
  await db.execute(sql`UPDATE xv_may SET nguon = nguon || ${JSON.stringify(nguon)}::jsonb, updated_at = now() WHERE ma = ${ma}`);
}
