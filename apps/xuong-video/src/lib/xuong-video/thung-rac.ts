// Thùng rác của studio (anh yêu cầu 08/10/2026, card #1192: "không được cho xoá thực, chỉ vào thùng rác/archive để lỡ bấm nhầm còn
// khôi phục"). Mọi đường xoá đi qua đây: chụp NGUYÊN bản ghi + mọi bản ghi con (tập → cảnh, anchor → biến thể…) + liên kết sổ job vào
// xv_thung_rac, rồi mới gỡ khỏi bảng sống. Khôi phục = chèn lại đúng id cũ, nối lại job → cảnh/anchor về y như trước, sổ chi phí không lệch.
// Ảnh (ảnh gốc, ứng viên keyframe, ảnh biến thể) chỉ gỡ khỏi danh sách; file R2 không bao giờ xoá. Thùng rác không có nút "xoá vĩnh viễn".
// File server thường (không 'use server'): chỉ actions.ts gọi, sau khi đã kiểm quyền admin.
import 'server-only';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;
export type LoaiRac = 'phim' | 'tap' | 'canh' | 'nhan_vat' | 'bien_the' | 'anh_goc' | 'keyframe' | 'anh_bien_the';
export type MucRac = { id: number; loai: LoaiRac; ten: string; phim_id: number | null; anh: string | null; xoa_luc: string; nguoi: string };

/** Thứ tự bảng khi chèn lại: cha trước con (khoá ngoại). */
const BANG = ['xv_phim', 'xv_nhan_vat', 'xv_bien_the', 'xv_tap', 'xv_canh'] as const;
type Bang = (typeof BANG)[number];
type ChupLai = { bang: Partial<Record<Bang, Row[]>>; job: Row[]; canh_bt?: { canh: number; bt: number }[] };

const mang = (xs: number[]) => `{${xs.map((x) => Math.trunc(Number(x))).filter(Number.isFinite).join(',')}}`;
const rows = async (db: Db, q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as Row[];
const ids = (rs: Row[]) => rs.map((r) => Number(r.id));

/** Chụp bản ghi + con cháu theo loại. */
async function chup(db: Db, loai: 'phim' | 'tap' | 'canh' | 'nhan_vat' | 'bien_the', dsId: number[]): Promise<ChupLai> {
  const a = mang(dsId);
  const b: ChupLai['bang'] = {};
  let canh: number[] = [], nv: number[] = [], bt: number[] = [], phim: number[] = [];
  if (loai === 'phim') {
    b.xv_phim = await rows(db, sql`SELECT * FROM xv_phim WHERE id = ANY(${a}::int[])`); phim = dsId;
    b.xv_nhan_vat = await rows(db, sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ANY(${a}::int[])`); nv = ids(b.xv_nhan_vat);
    b.xv_bien_the = await rows(db, sql`SELECT * FROM xv_bien_the WHERE nhan_vat_id = ANY(${mang(nv)}::int[])`); bt = ids(b.xv_bien_the);
    b.xv_tap = await rows(db, sql`SELECT * FROM xv_tap WHERE phim_id = ANY(${a}::int[])`);
    b.xv_canh = await rows(db, sql`SELECT * FROM xv_canh WHERE tap_id = ANY(${mang(ids(b.xv_tap))}::int[])`); canh = ids(b.xv_canh);
  } else if (loai === 'tap') {
    b.xv_tap = await rows(db, sql`SELECT * FROM xv_tap WHERE id = ANY(${a}::int[])`);
    b.xv_canh = await rows(db, sql`SELECT * FROM xv_canh WHERE tap_id = ANY(${a}::int[])`); canh = ids(b.xv_canh);
  } else if (loai === 'canh') {
    b.xv_canh = await rows(db, sql`SELECT * FROM xv_canh WHERE id = ANY(${a}::int[])`); canh = dsId;
  } else if (loai === 'nhan_vat') {
    b.xv_nhan_vat = await rows(db, sql`SELECT * FROM xv_nhan_vat WHERE id = ANY(${a}::int[])`); nv = dsId;
    b.xv_bien_the = await rows(db, sql`SELECT * FROM xv_bien_the WHERE nhan_vat_id = ANY(${a}::int[])`); bt = ids(b.xv_bien_the);
  } else {
    b.xv_bien_the = await rows(db, sql`SELECT * FROM xv_bien_the WHERE id = ANY(${a}::int[])`); bt = dsId;
  }
  // Job trỏ vào các bản ghi này sẽ bị SET NULL khi gỡ → giữ liên kết để khôi phục nối lại (sổ chi phí của cảnh/anchor không mất).
  const job = await rows(db, sql`SELECT id, phim_id, canh_id, nhan_vat_id, bien_the_id FROM xv_job
    WHERE canh_id = ANY(${mang(canh)}::int[]) OR nhan_vat_id = ANY(${mang(nv)}::int[]) OR bien_the_id = ANY(${mang(bt)}::int[]) OR phim_id = ANY(${mang(phim)}::int[])`);
  const kq: ChupLai = { bang: b, job };
  // Xoá biến thể còn gỡ id của nó khỏi các cảnh đang dùng → nhớ cảnh nào để gắn lại.
  if (loai === 'bien_the' || loai === 'nhan_vat') {
    const c = await rows(db, sql`SELECT c.id AS canh, (e::text)::int AS bt FROM xv_canh c, jsonb_array_elements(c.bien_the) e WHERE (e::text)::int = ANY(${mang(bt)}::int[])`);
    kq.canh_bt = c.map((x) => ({ canh: Number(x.canh), bt: Number(x.bt) }));
  }
  return kq;
}

async function ghiRac(db: Db, d: { loai: LoaiRac; ten: string; phim_id: number | null; anh?: string | null; du_lieu: unknown; nguoi: string }) {
  await db.execute(sql`INSERT INTO xv_thung_rac (loai, ten, phim_id, anh, du_lieu, nguoi)
    VALUES (${d.loai}, ${d.ten.slice(0, 300)}, ${d.phim_id}, ${d.anh ?? null}, ${JSON.stringify(d.du_lieu)}::jsonb, ${d.nguoi})`);
}

/** Bỏ bản ghi (và con cháu) vào thùng rác rồi gỡ khỏi bảng sống. */
export async function boVaoThungRac(db: Db, loai: 'phim' | 'tap' | 'canh' | 'nhan_vat' | 'bien_the', dsId: number[], nguoi: string, ten?: string): Promise<number> {
  if (!dsId.length) return 0;
  const du = await chup(db, loai, dsId);
  const goc = du.bang[({ phim: 'xv_phim', tap: 'xv_tap', canh: 'xv_canh', nhan_vat: 'xv_nhan_vat', bien_the: 'xv_bien_the' } as const)[loai]] ?? [];
  if (!goc.length) return 0;
  const r0 = goc[0]!;
  // phim_id để lọc thùng rác theo phim: lấy thẳng hoặc tra qua tập/anchor.
  let phimId: number | null = loai === 'phim' ? Number(r0.id) : r0.phim_id != null ? Number(r0.phim_id) : null;
  if (phimId == null && r0.tap_id != null) phimId = Number((await rows(db, sql`SELECT phim_id FROM xv_tap WHERE id = ${Number(r0.tap_id)}`))[0]?.phim_id ?? null);
  if (phimId == null && r0.nhan_vat_id != null) phimId = Number((await rows(db, sql`SELECT phim_id FROM xv_nhan_vat WHERE id = ${Number(r0.nhan_vat_id)}`))[0]?.phim_id ?? null);
  const nhan = ten ?? (goc.length > 1 ? `${goc.length} ${loai}` : String(r0.ten ?? r0.canh ?? `#${r0.id}`));
  const anh = (r0.keyframe_url ?? r0.anh_url ?? (Array.isArray(r0.anh_ref) ? r0.anh_ref[0] : null) ?? null) as string | null;
  await ghiRac(db, { loai, ten: nhan, phim_id: phimId, anh, du_lieu: du, nguoi });
  const a = mang(dsId);
  if (loai === 'phim') await db.execute(sql`DELETE FROM xv_phim WHERE id = ANY(${a}::int[])`);
  if (loai === 'tap') await db.execute(sql`DELETE FROM xv_tap WHERE id = ANY(${a}::int[])`);
  if (loai === 'canh') await db.execute(sql`DELETE FROM xv_canh WHERE id = ANY(${a}::int[])`);
  if (loai === 'nhan_vat') await db.execute(sql`DELETE FROM xv_nhan_vat WHERE id = ANY(${a}::int[])`);
  if (loai === 'bien_the') {
    await db.execute(sql`DELETE FROM xv_bien_the WHERE id = ANY(${a}::int[])`);
    await db.execute(sql`UPDATE xv_canh SET bien_the = coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(bien_the) e WHERE NOT ((e::text)::int = ANY(${a}::int[]))), '[]'::jsonb)
      WHERE id = ANY(${mang((du.canh_bt ?? []).map((x) => x.canh))}::int[])`);
  }
  return goc.length;
}

/** Bỏ một ẢNH vào thùng rác (ảnh gốc / ứng viên keyframe / ảnh biến thể): gỡ khỏi danh sách, nhớ chỗ để gắn lại. */
export async function boAnhVaoThungRac(db: Db, loai: 'anh_goc' | 'keyframe' | 'anh_bien_the', refId: number, url: string, nguoi: string): Promise<void> {
  if (loai === 'anh_goc') {
    const r = (await rows(db, sql`SELECT ten, phim_id, anh_ref FROM xv_nhan_vat WHERE id = ${refId}`))[0];
    if (!r) return;
    const viTri = (Array.isArray(r.anh_ref) ? (r.anh_ref as string[]) : []).indexOf(url);
    if (viTri < 0) return;
    await ghiRac(db, { loai, ten: `Ảnh gốc · ${String(r.ten)}`, phim_id: Number(r.phim_id), anh: url, du_lieu: { nhan_vat_id: refId, url, vi_tri: viTri }, nguoi });
    await db.execute(sql`UPDATE xv_nhan_vat SET anh_ref = anh_ref - ${url}, updated_at = now() WHERE id = ${refId}`);
  } else if (loai === 'keyframe') {
    const r = (await rows(db, sql`SELECT c.thu_tu, c.canh, c.keyframe_url, c.keyframe_uv, t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${refId}`))[0];
    if (!r) return;
    await ghiRac(db, { loai, ten: `Keyframe · cảnh #${String(r.thu_tu)} ${String(r.canh)}`, phim_id: Number(r.phim_id), anh: url, du_lieu: { canh_id: refId, url, la_chinh: r.keyframe_url === url }, nguoi });
    await db.execute(sql`UPDATE xv_canh SET keyframe_uv = keyframe_uv - ${url},
        keyframe_url = CASE WHEN keyframe_url = ${url} THEN (keyframe_uv - ${url})->>0 ELSE keyframe_url END,
        trang_thai = CASE WHEN jsonb_array_length(keyframe_uv - ${url}) = 0 AND trang_thai IN ('co_keyframe', 'duyet') THEN 'nhap' ELSE trang_thai END,
        updated_at = now() WHERE id = ${refId}`);
  } else {
    const r = (await rows(db, sql`SELECT b.ten, b.anh_url, v.ten AS v_ten, v.phim_id FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE b.id = ${refId}`))[0];
    if (!r || !r.anh_url) return;
    await ghiRac(db, { loai, ten: `Ảnh biến thể · ${String(r.v_ten)} · ${String(r.ten)}`, phim_id: Number(r.phim_id), anh: String(r.anh_url), du_lieu: { bien_the_id: refId, url: r.anh_url }, nguoi });
    await db.execute(sql`UPDATE xv_bien_the SET anh_url = NULL, updated_at = now() WHERE id = ${refId}`);
  }
}

export async function dsRac(db: Db, phimId: number | null): Promise<MucRac[]> {
  const r = await rows(db, phimId == null
    ? sql`SELECT id, loai, ten, phim_id, anh, xoa_luc, nguoi FROM xv_thung_rac WHERE khoi_phuc_luc IS NULL AND loai = 'phim' ORDER BY id DESC LIMIT 200`
    : sql`SELECT id, loai, ten, phim_id, anh, xoa_luc, nguoi FROM xv_thung_rac WHERE khoi_phuc_luc IS NULL AND phim_id = ${phimId} AND loai <> 'phim' ORDER BY id DESC LIMIT 300`);
  return r.map((x) => ({ id: Number(x.id), loai: String(x.loai) as LoaiRac, ten: String(x.ten), phim_id: x.phim_id == null ? null : Number(x.phim_id), anh: x.anh == null ? null : String(x.anh), xoa_luc: new Date(x.xoa_luc as string).toISOString(), nguoi: String(x.nguoi) }));
}

/** Khôi phục một mục. Mục con mà cha đang ở thùng rác (vd cảnh của một tập đã xoá) → báo khôi phục cha trước. */
export async function khoiPhucRac(db: Db, id: number): Promise<{ ok: true } | { ok: false; loi: string }> {
  const m = (await rows(db, sql`SELECT * FROM xv_thung_rac WHERE id = ${id} AND khoi_phuc_luc IS NULL`))[0];
  if (!m) return { ok: false, loi: 'mục không còn trong thùng rác' };
  const loai = String(m.loai) as LoaiRac;
  const du = m.du_lieu as Record<string, unknown>;
  try {
    if (loai === 'anh_goc') {
      const url = String(du.url);
      const r = await rows(db, sql`UPDATE xv_nhan_vat SET anh_ref = CASE WHEN anh_ref ? ${url} THEN anh_ref ELSE anh_ref || ${JSON.stringify([url])}::jsonb END, updated_at = now() WHERE id = ${Number(du.nhan_vat_id)} RETURNING id`);
      if (!r.length) return { ok: false, loi: 'anchor của ảnh này đang ở thùng rác — khôi phục anchor trước' };
    } else if (loai === 'keyframe') {
      const url = String(du.url);
      const r = await rows(db, sql`UPDATE xv_canh SET keyframe_uv = CASE WHEN keyframe_uv ? ${url} THEN keyframe_uv ELSE keyframe_uv || ${JSON.stringify([url])}::jsonb END,
          keyframe_url = CASE WHEN keyframe_url IS NULL OR ${du.la_chinh === true} THEN ${url} ELSE keyframe_url END,
          trang_thai = CASE WHEN trang_thai = 'nhap' THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${Number(du.canh_id)} RETURNING id`);
      if (!r.length) return { ok: false, loi: 'cảnh của ảnh này đang ở thùng rác — khôi phục cảnh/tập trước' };
    } else if (loai === 'anh_bien_the') {
      const r = await rows(db, sql`UPDATE xv_bien_the SET anh_url = ${String(du.url)}, updated_at = now() WHERE id = ${Number(du.bien_the_id)} AND anh_url IS NULL RETURNING id`);
      if (!r.length) return { ok: false, loi: 'biến thể đã có ảnh mới, hoặc biến thể đang ở thùng rác' };
    } else {
      const c = du as unknown as ChupLai;
      for (const t of BANG) {
        const ds = c.bang?.[t];
        if (!ds?.length) continue;
        await db.execute(sql`INSERT INTO ${sql.raw(t)} SELECT * FROM jsonb_populate_recordset(NULL::${sql.raw(t)}, ${JSON.stringify(ds)}::jsonb) ON CONFLICT (id) DO NOTHING`);
      }
      if (c.job?.length) {
        await db.execute(sql`UPDATE xv_job j SET phim_id = coalesce(j.phim_id, x.phim_id), canh_id = coalesce(j.canh_id, x.canh_id),
            nhan_vat_id = coalesce(j.nhan_vat_id, x.nhan_vat_id), bien_the_id = coalesce(j.bien_the_id, x.bien_the_id)
          FROM jsonb_to_recordset(${JSON.stringify(c.job)}::jsonb) AS x(id int, phim_id int, canh_id int, nhan_vat_id int, bien_the_id int) WHERE j.id = x.id`);
      }
      // Gắn lại biến thể vào đúng từng cảnh từng dùng nó (cặp cảnh–biến thể chụp lúc xoá).
      for (const x of c.canh_bt ?? []) {
        await db.execute(sql`UPDATE xv_canh SET bien_the = bien_the || ${JSON.stringify([x.bt])}::jsonb
          WHERE id = ${x.canh} AND NOT bien_the @> ${JSON.stringify([x.bt])}::jsonb`);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/foreign key/i.test(msg)) return { ok: false, loi: 'mục cha (phim/tập/anchor) đang ở thùng rác — khôi phục mục cha trước' };
    return { ok: false, loi: msg.slice(0, 200) };
  }
  await db.execute(sql`UPDATE xv_thung_rac SET khoi_phuc_luc = now() WHERE id = ${id}`);
  return { ok: true };
}
