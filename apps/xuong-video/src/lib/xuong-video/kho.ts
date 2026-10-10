// Kho tài sản dùng lại (10/10/2026, anh: "nhạc nền chất lượng cao đã sinh có thể lưu lại vào thư viện và dùng cho nhiều creative").
// Creative sau lấy clip/keyframe đạt, nhạc nền, preset giọng, khuôn QC từ kho thay vì sinh lại — tiết kiệm tiền và giữ đúng sản phẩm.
// MỘT cửa ghi/đọc/dùng cho nút trên studio (actions) và script trên box. Bỏ khỏi kho = xoa_luc (không xoá thật).
import 'server-only';
import { sql } from 'drizzle-orm';
import { chupTruoc } from './hoan-tac';
import { mapCanh, s, n, type Db, type Row } from './doc-db';
import { thuongHieu, type KinhThanh, type LoaiTaiSan, type TaiSan } from './kieu';

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

const mapTaiSan = (r: Row): TaiSan => ({
  id: n(r.id), loai: s(r.loai) as LoaiTaiSan, ten: s(r.ten), url: r.url == null ? null : s(r.url), thuong_hieu: s(r.thuong_hieu), san_pham: s(r.san_pham),
  the: (r.the as string[]) ?? [], mo_ta: s(r.mo_ta), so_do: (r.so_do ?? {}) as TaiSan['so_do'], du_lieu: (r.du_lieu ?? {}) as Record<string, unknown>,
  nguon: (r.nguon ?? {}) as TaiSan['nguon'], chi_phi_cents: n(r.chi_phi_cents), so_lan_dung: n(r.so_lan_dung), created_at: s(r.created_at),
});

/** Tiền đã bỏ ra để sinh tệp (job có output_url đúng tệp) — kho hiện "giá trị" của tài sản, so được với giá sinh lại. */
async function giaTep(db: Db, url: string | null): Promise<{ cents: number; job: number | null }> {
  if (!url) return { cents: 0, job: null };
  const r = (await db.execute(sql`SELECT id, chi_phi_cents FROM xv_job WHERE output_url = ${url} AND trang_thai = 'xong' ORDER BY id DESC LIMIT 1`)) as unknown as Row[];
  return r[0] ? { cents: n(r[0].chi_phi_cents), job: n(r[0].id) } : { cents: 0, job: null };
}

/** Ghi (hoặc cập nhật nhãn) một tài sản có tệp — trùng (loai, url) thì cập nhật, không tạo bản thứ hai; đã bỏ thì đưa lại vào kho. */
export async function luuVaoKho(db: Db, t: { loai: LoaiTaiSan; url: string; ten: string; thuong_hieu: string; san_pham?: string; the?: string[]; mo_ta?: string; so_do?: Record<string, unknown>; nguon?: Record<string, unknown> }): Promise<number> {
  const g = await giaTep(db, t.url);
  const r = (await db.execute(sql`INSERT INTO xv_tai_san (loai, ten, url, thuong_hieu, san_pham, the, mo_ta, so_do, nguon, chi_phi_cents)
    VALUES (${t.loai}, ${t.ten}, ${t.url}, ${t.thuong_hieu}, ${t.san_pham ?? ''}, ${`{${(t.the ?? []).map((x) => `"${x.replace(/["\\]/g, '')}"`).join(',')}}`}::text[], ${t.mo_ta ?? ''},
      ${JSON.stringify(t.so_do ?? {})}::jsonb, ${JSON.stringify({ ...(t.nguon ?? {}), ...(g.job ? { job_id: g.job } : {}) })}::jsonb, ${g.cents})
    ON CONFLICT (loai, url) WHERE url IS NOT NULL DO UPDATE SET ten = EXCLUDED.ten, san_pham = EXCLUDED.san_pham, the = EXCLUDED.the, mo_ta = EXCLUDED.mo_ta,
      so_do = xv_tai_san.so_do || EXCLUDED.so_do, xoa_luc = NULL, updated_at = now()
    RETURNING id`)) as unknown as Row[];
  return n(r[0]!.id);
}

/** Lưu shot ĐẠT vào kho: keyframe đang chọn (ảnh) + clip đang dùng (bản cuối, không thì nháp). Nhãn = sản phẩm/anchor trong shot,
 *  loại shot, góc máy; mô tả = cảnh + hành động — creative sau tìm theo sản phẩm + động tác. */
export async function luuShotVaoKho(db: Db, canhId: number): Promise<Kq<number>> {
  const r = (await db.execute(sql`SELECT c.*, t.phim_id, p.project, p.kinh_thanh, p.ten AS phim_ten, p.kinh_thanh->>'ti_le' AS ti_le FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy shot');
  const c = mapCanh(r[0]);
  const nv = c.nhan_vat.length ? ((await db.execute(sql`SELECT ten, loai FROM xv_nhan_vat WHERE id = ANY(${`{${c.nhan_vat.join(',')}}`}::int[])`)) as unknown as Row[]) : [];
  const sp = nv.filter((x) => s(x.loai) === 'san_pham').map((x) => s(x.ten)).join(', ');
  const the = [...nv.filter((x) => s(x.loai) !== 'san_pham').map((x) => s(x.ten)), c.goc_may].filter(Boolean).slice(0, 6);
  const moTa = [c.canh, c.hanh_dong].filter(Boolean).join(' — ');
  const nguon = { phim_id: n(r[0].phim_id), tap_id: c.tap_id, canh_id: c.id };
  const chung = { thuong_hieu: thuongHieu(s(r[0].project), r[0].kinh_thanh as KinhThanh), san_pham: sp, the, mo_ta: moTa, nguon };
  const tenGoc = `${s(r[0].phim_ten)} · shot ${c.thu_tu}`;
  let so = 0;
  if (c.keyframe_url) { await luuVaoKho(db, { ...chung, loai: 'anh', url: c.keyframe_url, ten: `${tenGoc} · keyframe`, so_do: { ti_le: s(r[0].ti_le), prompt: c.prompt_anh } }); so++; }
  const clip = c.video_cuoi_url || c.video_url;
  if (clip) { await luuVaoKho(db, { ...chung, loai: 'clip', url: clip, ten: `${tenGoc} · clip`, so_do: { ti_le: s(r[0].ti_le), keyframe_url: c.keyframe_url, thoi_luong_s: c.thoi_luong_s, prompt: c.prompt_video, ban: c.video_cuoi_url ? 'cuoi' : 'nhap' } }); so++; }
  return so ? { ok: true, data: so } : loi('shot chưa có keyframe hay clip để lưu');
}

/** Danh sách kho (chưa bỏ), mới trước; lọc loại / thương hiệu / chữ (tên, sản phẩm, mô tả, nhãn). */
export async function dsKho(db: Db, o: { loai?: LoaiTaiSan[]; thuongHieu?: string; q?: string } = {}): Promise<TaiSan[]> {
  const q = (o.q ?? '').trim().toLowerCase();
  const r = (await db.execute(sql`SELECT * FROM xv_tai_san WHERE xoa_luc IS NULL
    ${o.loai?.length ? sql`AND loai = ANY(${`{${o.loai.join(',')}}`}::text[])` : sql``}
    ${o.thuongHieu ? sql`AND thuong_hieu = ${o.thuongHieu}` : sql``}
    ${q ? sql`AND lower(ten || ' ' || san_pham || ' ' || mo_ta || ' ' || array_to_string(the, ' ')) LIKE ${`%${q}%`}` : sql``}
    ORDER BY id DESC LIMIT 300`)) as unknown as Row[];
  return r.map(mapTaiSan);
}

/** Dùng tài sản cho một đích: clip/ảnh → shot (clip kèm keyframe gốc của nó để thẻ shot + video khớp), nhạc → tập. Chụp trước để ↶ Hoàn tác. */
export async function dungTaiSan(db: Db, id: number, dich: { canhId?: number; tapId?: number }, nguoi: string): Promise<Kq> {
  const r = (await db.execute(sql`SELECT * FROM xv_tai_san WHERE id = ${id} AND xoa_luc IS NULL`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy tài sản trong kho');
  const t = mapTaiSan(r[0]);
  if (!t.url) return loi('tài sản này không có tệp');
  if ((t.loai === 'clip' || t.loai === 'anh') && dich.canhId) {
    if (t.loai === 'clip') {
      await chupTruoc(db, { bang: 'xv_canh', id: dich.canhId, cot: ['video_url', 'video_cuoi_url', 'keyframe_url', 'trang_thai'], moTa: `lấy clip từ kho (#${id})`, nguoi });
      const kf = typeof t.so_do.keyframe_url === 'string' ? t.so_do.keyframe_url : null;
      await db.execute(sql`UPDATE xv_canh SET video_url = ${t.url}, video_cuoi_url = NULL, keyframe_url = coalesce(${kf}, keyframe_url), trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${dich.canhId}`);
    } else {
      await chupTruoc(db, { bang: 'xv_canh', id: dich.canhId, cot: ['keyframe_url', 'trang_thai'], moTa: `lấy keyframe từ kho (#${id})`, nguoi });
      await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${t.url}, trang_thai = CASE WHEN trang_thai IN ('nhap', 'co_keyframe') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${dich.canhId}`);
    }
  } else if (t.loai === 'nhac' && dich.tapId) {
    await chupTruoc(db, { bang: 'xv_tap', id: dich.tapId, cot: ['nhac_url'], moTa: `lấy nhạc từ kho (#${id})`, nguoi });
    await db.execute(sql`UPDATE xv_tap SET nhac_url = ${t.url}, updated_at = now() WHERE id = ${dich.tapId}`);
  } else return loi(`không dùng được ${t.loai} cho đích này`);
  await db.execute(sql`UPDATE xv_tai_san SET so_lan_dung = so_lan_dung + 1, updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

/** Bỏ khỏi kho (không xoá thật, tệp vẫn nguyên). */
export async function boKhoiKho(db: Db, id: number): Promise<void> {
  await db.execute(sql`UPDATE xv_tai_san SET xoa_luc = now(), updated_at = now() WHERE id = ${id}`);
}
