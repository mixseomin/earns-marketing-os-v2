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

/* ── Tư vấn (chat mặt tiền) — bảng /shop › Tư vấn ── */
export type NhapTV = { noi_dung?: string; nhom?: string; chu_de?: string; kiem?: { ok: boolean; ly_do: string[] }; luc: string; dang_soan?: boolean; loi?: string };
export type ChatDong = { id: number; cuaHang: string; domain: string; ten: string | null; email: string | null; cot: string; trangThai: string; nhap: NhapTV | null;
  khachCuoi: string | null; capNhat: string; taoLuc: string; soDon: string | null; donId: number | null;
  tinCuoi: { nguoi: string; noiDung: string; ts: string } | null; tinKhach: string | null; nayKhach: number; nayMay: number; nayMinh: number;
  phien: { trang: string | null; chang: number; gio: number; soDon: string | null; online: boolean; thietBi: string | null; nuoc: string | null } | null };

/** Chat đang mở + chat có tin trong 14 ngày. "nay*" = số tin hôm nay (giờ VN) theo người nói. */
export async function docTuVan(): Promise<ChatDong[]> {
  const r = await q(sql`
    SELECT h.id, c.khoa, c.domain, h.ten, h.email, COALESCE(h.cot, 'truoc_mua') AS cot, h.trang_thai, h.nhap, h.khach_cuoi::text AS khach_cuoi,
           h.cap_nhat::text AS cap_nhat, h.tao_luc::text AS tao_luc, h.don_id, d.so_don,
           (SELECT json_build_object('nguoi', t.nguoi, 'noiDung', left(t.noi_dung, 300), 'ts', t.ts) FROM shop_ho_so_tin t WHERE t.ho_so_id = h.id AND t.kenh = 'chat' ORDER BY t.ts DESC, t.id DESC LIMIT 1) AS tin_cuoi,
           (SELECT left(t.noi_dung, 300) FROM shop_ho_so_tin t WHERE t.ho_so_id = h.id AND t.kenh = 'chat' AND t.nguoi = 'khach' ORDER BY t.ts DESC, t.id DESC LIMIT 1) AS tin_khach,
           (SELECT COUNT(*) FILTER (WHERE t.nguoi = 'khach') FROM shop_ho_so_tin t WHERE t.ho_so_id = h.id AND t.kenh = 'chat' AND t.ts >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh') AS nay_khach,
           (SELECT COUNT(*) FILTER (WHERE t.nguoi = 'may') FROM shop_ho_so_tin t WHERE t.ho_so_id = h.id AND t.kenh = 'chat' AND t.ts >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh') AS nay_may,
           (SELECT COUNT(*) FILTER (WHERE t.nguoi = 'minh') FROM shop_ho_so_tin t WHERE t.ho_so_id = h.id AND t.kenh = 'chat' AND t.ts >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh') AS nay_minh,
           p.trang_hien, p.chang, p.gio_gia, p.so_don AS p_so_don, p.cuoi > now() - interval '90 seconds' AS online, p.thiet_bi, p.nuoc
      FROM shop_ho_so h JOIN shop_cua_hang c ON c.id = h.cua_hang_id LEFT JOIN shop_don d ON d.id = h.don_id LEFT JOIN shop_phien p ON p.id = h.phien_id
     WHERE h.loai = 'tu_van' AND (h.trang_thai <> 'xong' OR h.cap_nhat > now() - interval '14 days')
     ORDER BY h.cap_nhat DESC LIMIT 300`);
  return r.map((x) => ({ id: Number(x.id), cuaHang: String(x.khoa), domain: String(x.domain), ten: (x.ten as string) ?? null, email: (x.email as string) ?? null,
    cot: String(x.cot), trangThai: String(x.trang_thai), nhap: (x.nhap as NhapTV) ?? null, khachCuoi: (x.khach_cuoi as string) ?? null,
    capNhat: String(x.cap_nhat), taoLuc: String(x.tao_luc), soDon: (x.so_don as string) ?? null, donId: x.don_id == null ? null : Number(x.don_id),
    tinCuoi: (x.tin_cuoi as ChatDong['tinCuoi']) ?? null, tinKhach: (x.tin_khach as string) ?? null,
    nayKhach: Number(x.nay_khach), nayMay: Number(x.nay_may), nayMinh: Number(x.nay_minh),
    phien: x.chang == null ? null : { trang: (x.trang_hien as string) ?? null, chang: Number(x.chang), gio: Number(x.gio_gia), soDon: (x.p_so_don as string) ?? null,
      online: !!x.online, thietBi: (x.thiet_bi as string) ?? null, nuoc: (x.nuoc as string) ?? null } }));
}

/* ── Sổ nhà cung cấp (shop_ncc) — tầng KÊNH → NCC của cây nguồn hàng ── */
export type LienHeNcc = { kenh: string; gia_tri: string; ten?: string };
export type NccDong = { khoa: string; ten: string; /** cj · alibaba · 1688 · aliexpress · xuong · khac */ kenh: string; /** có bộ kết nối đặt đơn/trả/vận đơn */ coApi: boolean;
  website: string | null; taiKhoan: string | null; links: { nhan: string; url: string }[]; lienHe: LienHeNcc[]; ghiChu: string | null; capNhat: string };
export async function docNcc(): Promise<NccDong[]> {
  const r = await q(sql`SELECT khoa, ten, kenh, co_api, website, tai_khoan, links, lien_he, ghi_chu, cap_nhat::text AS cap_nhat FROM shop_ncc ORDER BY co_api DESC, kenh, ten`);
  return r.map((x) => ({ khoa: String(x.khoa), ten: String(x.ten), kenh: String(x.kenh ?? 'khac'), coApi: !!x.co_api, website: (x.website as string) ?? null, taiKhoan: (x.tai_khoan as string) ?? null,
    links: (x.links as NccDong['links']) ?? [], lienHe: (x.lien_he as LienHeNcc[]) ?? [], ghiChu: (x.ghi_chu as string) ?? null, capNhat: String(x.cap_nhat) }));
}

/* ── Biến động (shop_ncc_bien_dong) — hai phía: NCC (giá, gỡ/về lại, ngừng/bán lại, tồn thấp/hết — một dòng cho mọi shop)
 *    và shop (tự ẩn, mở lại, đổi nguồn — gắn biến thể shop). Dòng cũ trước 0205 chỉ có phía shop. */
export type BienDongNcc = { id: number; luc: string; loai: string; cu: string | null; moi: string | null;
  cuaHang: string | null; btId: number | null; sanPham: string | null; bienThe: string | null;
  ncc: string | null; nccSpId: number | null; nccBtId: number | null; tenNccSp: string | null; tenNccBt: string | null };
export async function docBienDongNcc(): Promise<BienDongNcc[]> {
  const r = await q(sql`
    SELECT d.id, d.luc::text AS luc, d.loai, d.cu, d.moi, c.khoa, d.bien_the_id, p.ten AS sp, b.ten AS bt, d.ncc_sp_id, d.ncc_bt_id, s.ten AS ten_ncc_sp, t.ten AS ten_ncc_bt,
           COALESCE(s.ncc, (SELECT s2.ncc FROM shop_nguon n JOIN shop_ncc_bt t2 ON t2.id = n.ncc_bt_id JOIN shop_ncc_sp s2 ON s2.id = t2.ncc_sp_id WHERE n.id = b.nguon_id), c.ncc) AS ncc
      FROM shop_ncc_bien_dong d LEFT JOIN shop_cua_hang c ON c.id = d.cua_hang_id LEFT JOIN shop_san_pham p ON p.id = d.san_pham_id
      LEFT JOIN shop_bien_the b ON b.id = d.bien_the_id LEFT JOIN shop_ncc_sp s ON s.id = d.ncc_sp_id LEFT JOIN shop_ncc_bt t ON t.id = d.ncc_bt_id
     WHERE d.luc > now() - interval '60 days' ORDER BY d.luc DESC, d.id DESC LIMIT 500`);
  const n = (v: unknown) => (v == null ? null : Number(v));
  return r.map((x) => ({ id: Number(x.id), luc: String(x.luc), loai: String(x.loai), cu: (x.cu as string) ?? null, moi: (x.moi as string) ?? null,
    cuaHang: (x.khoa as string) ?? null, btId: n(x.bien_the_id), sanPham: (x.sp as string) ?? null, bienThe: (x.bt as string) ?? null,
    ncc: (x.ncc as string) ?? null, nccSpId: n(x.ncc_sp_id), nccBtId: n(x.ncc_bt_id), tenNccSp: (x.ten_ncc_sp as string) ?? null, tenNccBt: (x.ten_ncc_bt as string) ?? null }));
}
