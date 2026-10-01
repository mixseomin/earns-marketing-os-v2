// SHOP — đọc sổ hồ sơ trao đổi (khách / NCC) cho /shop. Định nghĩa loại + trạng thái: @mos2/shop/ho-so.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

type Row = Record<string, unknown>;
const q = async (s: ReturnType<typeof sql>) => { const d = getDb(); if (!d) return [] as Row[]; return (await d.execute(s)) as unknown as Row[]; };

export type HoSoDong = { id: number; cuaHang: string; ben: 'khach' | 'ncc'; loai: string; trangThai: string; tieuDe: string; donId: number | null; soDon: string | null;
  ten: string | null; email: string | null; nguon: string; maNgoai: string | null; soTien: number | null; han: string | null; ketQua: string | null;
  taoLuc: string; capNhat: string; soTin: number; tinCuoi: { nguoi: string; noiDung: string; ts: string } | null };
export type TinHoSo = { id: number; ts: string; nguoi: string; kenh: string; noiDung: string; loi: boolean };

/** Hồ sơ đang mở + hồ sơ đóng trong 90 ngày (sổ nhỏ — một lượt đọc hết, lọc ở trình duyệt như sổ đơn). */
export async function docHoSo(): Promise<HoSoDong[]> {
  const r = await q(sql`
    SELECT h.id, c.khoa, h.ben, h.loai, h.trang_thai, h.tieu_de, h.don_id, d.so_don, h.ten, h.email, h.nguon, h.ma_ngoai, h.so_tien, h.han::text AS han, h.ket_qua,
           h.tao_luc::text AS tao_luc, h.cap_nhat::text AS cap_nhat,
           (SELECT COUNT(*) FROM shop_ho_so_tin t WHERE t.ho_so_id = h.id) AS so_tin,
           (SELECT json_build_object('nguoi', t.nguoi, 'noiDung', left(t.noi_dung, 200), 'ts', t.ts) FROM shop_ho_so_tin t WHERE t.ho_so_id = h.id ORDER BY t.ts DESC, t.id DESC LIMIT 1) AS tin_cuoi
      FROM shop_ho_so h JOIN shop_cua_hang c ON c.id = h.cua_hang_id LEFT JOIN shop_don d ON d.id = h.don_id
     WHERE h.trang_thai <> 'xong' OR h.cap_nhat > now() - interval '90 days'
     ORDER BY (h.trang_thai = 'xong'), h.han NULLS LAST, h.cap_nhat DESC`);
  return r.map((x) => ({ id: Number(x.id), cuaHang: String(x.khoa), ben: x.ben as 'khach' | 'ncc', loai: String(x.loai), trangThai: String(x.trang_thai), tieuDe: String(x.tieu_de),
    donId: x.don_id == null ? null : Number(x.don_id), soDon: (x.so_don as string) ?? null, ten: (x.ten as string) ?? null, email: (x.email as string) ?? null,
    nguon: String(x.nguon), maNgoai: (x.ma_ngoai as string) ?? null, soTien: x.so_tien == null ? null : Number(x.so_tien), han: (x.han as string) ?? null,
    ketQua: (x.ket_qua as string) ?? null, taoLuc: String(x.tao_luc), capNhat: String(x.cap_nhat), soTin: Number(x.so_tin),
    tinCuoi: (x.tin_cuoi as HoSoDong['tinCuoi']) ?? null }));
}

export async function docTinHoSo(id: number): Promise<TinHoSo[]> {
  const r = await q(sql`SELECT id, ts::text AS ts, nguoi, kenh, noi_dung, loi FROM shop_ho_so_tin WHERE ho_so_id = ${id} ORDER BY ts, id`);
  return r.map((x) => ({ id: Number(x.id), ts: String(x.ts), nguoi: String(x.nguoi), kenh: String(x.kenh), noiDung: String(x.noi_dung), loi: !!x.loi }));
}
