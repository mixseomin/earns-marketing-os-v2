// MÁY → VIDEO (anh 17/10/2026, duyệt bố cục "Tự động · Theo template · Làm tự do"). Một MÁY = mẫu dựng + nguồn đề + luật chọn + nơi đăng;
// mỗi VIDEO là một dòng nhẹ của xv_may_video (đề, video, 3 khung, sổ đăng từng nền) — không phim / tập / shot riêng, nên lên số lớn được.
// Cửa vào cho máy ngoài studio: scripts/may-dung.mts (puzzle-books qua ssh: nạp đề, xuất, đọc danh sách đăng, ghi sổ đăng, ghi số nguồn).
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { dungVideo } from './may-dung';
import type { DeMotDung } from './may-dung-do-chu';
import { MAU_MAY_DUNG, type MauMayDung } from './may-dung-mau';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;

export type NenDang = { nen: string; ten: string; tk: string; gio: string; tran: number; kem: string; may: string };
export type DaDang = { url: string; ngay: string; luc?: string; binhLuan?: boolean };
export type May = {
  id: number; ma: string; ten: string; du_an: string; muc_dich: string; mau: MauMayDung; chay: boolean;
  nguon: { mo_ta?: string; dung?: number; tong?: number }; luat: string[]; dang: NenDang[];
  so: { video: number; cho_dang: number; luu_tru: number };
};
export type VideoMay = {
  id: number; slug: string; chu_de: string; de: DeMotDung; dang: { title?: string; description?: string; link?: string; book?: string; words?: string[] };
  video_url: string | null; khung: string[]; giay: number | null; xuat_luc: string | null; da_dang: Record<string, DaDang>; luu_tru: boolean; created_at: string;
};
export type DeNapMay = { slug: string; chu_de: string; de: DeMotDung; dang: VideoMay['dang'] };

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
  id: Number(r.id), slug: String(r.slug), chu_de: String(r.chu_de ?? ''), de: r.de as DeMotDung, dang: (r.dang ?? {}) as VideoMay['dang'],
  video_url: (r.video_url as string | null) ?? null, khung: (r.khung ?? []) as string[], giay: r.giay == null ? null : Number(r.giay),
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
export async function chiTietMay(db: Db, id: number, o: { luuTru?: boolean; gioiHan?: number } = {}): Promise<{ may: May; video: VideoMay[] } | null> {
  const r = ((await db.execute(sql`SELECT ${COT_MAY} FROM xv_may m WHERE m.id = ${id}`)) as unknown as Row[])[0];
  if (!r) return null;
  const v = (await db.execute(sql`SELECT * FROM xv_may_video WHERE may_id = ${id} AND (${!!o.luuTru} OR NOT luu_tru) ORDER BY luu_tru, id DESC LIMIT ${o.gioiHan ?? 15}`)) as unknown as Row[];
  return { may: mapMay(r), video: v.map(mapVideo) };
}

/** Nạp đề (khoá = slug trong máy): chưa có → thêm; đề đổi → ghi đề mới, bỏ video cũ (xuất lại); chỉ chữ đăng đổi → cập nhật chữ. */
export async function napVideo(db: Db, ma: string, ds: DeNapMay[]): Promise<{ moi: number; doi: number; giu: number }> {
  const m = await mayTheoMa(db, ma); if (!m) throw new Error(`không có máy "${ma}"`);
  if (!MAU_MAY_DUNG[m.mau]) throw new Error(`máy ${ma}: mẫu lạ ${m.mau}`);
  let moi = 0, doi = 0, giu = 0;
  for (const x of ds) {
    const cu = ((await db.execute(sql`SELECT id, de, dang, chu_de FROM xv_may_video WHERE may_id = ${m.id} AND slug = ${x.slug}`)) as unknown as Row[])[0];
    if (!cu) {
      await db.execute(sql`INSERT INTO xv_may_video (may_id, slug, chu_de, de, dang) VALUES (${m.id}, ${x.slug}, ${x.chu_de}, ${JSON.stringify(x.de)}::jsonb, ${JSON.stringify(x.dang)}::jsonb)`);
      moi++; continue;
    }
    const deDoi = JSON.stringify(cu.de) !== JSON.stringify(x.de), chuDoi = JSON.stringify(cu.dang) !== JSON.stringify(x.dang) || cu.chu_de !== x.chu_de;
    if (!deDoi && !chuDoi) { giu++; continue; }
    if (deDoi) await db.execute(sql`UPDATE xv_may_video SET de = ${JSON.stringify(x.de)}::jsonb, dang = ${JSON.stringify(x.dang)}::jsonb, chu_de = ${x.chu_de}, video_url = NULL, khung = '[]'::jsonb, xuat_luc = NULL, updated_at = now() WHERE id = ${Number(cu.id)}`);
    else await db.execute(sql`UPDATE xv_may_video SET dang = ${JSON.stringify(x.dang)}::jsonb, chu_de = ${x.chu_de}, updated_at = now() WHERE id = ${Number(cu.id)}`);
    doi++;
  }
  return { moi, doi, giu };
}

/** Dựng video của một dòng (0đ) → video_url + 3 khung. */
export async function xuatVideo(db: Db, videoId: number): Promise<{ ok: true; url: string } | { ok: false; loi: string }> {
  const r = ((await db.execute(sql`SELECT slug, de, nen_url FROM xv_may_video WHERE id = ${videoId}`)) as unknown as Row[])[0];
  if (!r) return { ok: false, loi: `không có video #${videoId}` };
  const v = await dungVideo({ de: r.de as DeMotDung, nenUrl: (r.nen_url as string | null) ?? null, slug: String(r.slug) });
  if (!v.ok) return v;
  await db.execute(sql`UPDATE xv_may_video SET video_url = ${v.url}, khung = ${JSON.stringify(v.khung)}::jsonb, giay = ${v.giay}, xuat_luc = now(), updated_at = now() WHERE id = ${videoId}`);
  return { ok: true, url: v.url };
}

/** Danh sách cho bên đăng / bên đọc số: { slug: { id, file_url, xuat_luc, da_dang, ...chữ đăng } }. Mặc định bỏ video lưu trữ. */
export async function dsVideoDang(db: Db, ma: string, caLuuTru = false): Promise<Record<string, Row>> {
  const m = await mayTheoMa(db, ma); if (!m) throw new Error(`không có máy "${ma}"`);
  const rows = (await db.execute(sql`SELECT * FROM xv_may_video WHERE may_id = ${m.id} AND (${caLuuTru} OR NOT luu_tru) ORDER BY id`)) as unknown as Row[];
  return Object.fromEntries(rows.map((r) => { const v = mapVideo(r); return [v.slug, { id: v.id, file_url: v.video_url, xuat_luc: v.xuat_luc, da_dang: v.da_dang, luu_tru: v.luu_tru, ...v.dang, kieu: 'an', mau: m.mau }]; }));
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
