// SHOP — đọc sổ cho màn /shop. Sổ nhỏ, cùng box (vài trăm đơn) → một lượt đọc hết 120 ngày, lọc/tìm ở trình duyệt.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { buocCua, type Buoc } from './buoc';
import type { Moc } from './track17';
import { hanhTrinh, type HanhTrinh } from '@mos2/shop/hanh-trinh';
import type { MatTien } from '@mos2/shop/mat-tien';

type Row = Record<string, unknown>;
const q = async <T = Row>(s: ReturnType<typeof sql>) => { const d = getDb(); if (!d) return [] as T[]; return (await d.execute(s)) as unknown as T[]; };
const so = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export type DonDong = {
  id: number; cuaHang: string; nenTang: string; domain: string; maNgoai: string; soDon: string; trangThaiShop: string; buoc: Buoc;
  khach: string; email: string; nuoc: string; bang: string; tong: number; hoan: number; taoLuc: string; sid: string | null; soMon: number; tenMon: string;
  giaVon: number | null; shipNcc: number | null; phiCong: number | null; lai: number | null;
  ncc: { /** khoá NCC của đơn (shop_don_ncc.ncc) */ nha: string; maNcc: string | null; trangThai: string; daTra: boolean; tuyen: string | null; soNgay: string | null; maVanDon: string | null; hang: string | null;
    guiLuc: string | null; giaoLuc: string | null; vanDon: string | null; loi: string | null;
    /** tiền hàng CJ báo cho đơn này (createOrderV2/getOrderDetail) — số thật sẽ trừ ví, không phải ước theo giá vốn sổ */ tienHang: number | null } | null;
  /** Chặng hành trình (Nhận đơn → … → Trao tận nơi) — null với đơn chưa trả tiền / đã huỷ. */
  ht: HanhTrinh | null;
};
export type BienTheDong = { id: number; sanPhamId: number; sanPham: string; anh: string | null; link: string | null; cuaHang: string; maNgoai: string;
  ten: string; sku: string | null; giaBan: number | null; maNcc: string | null; giaVon: number | null; daBan: number;
  /** ẢNH CỦA NGUỒN ĐANG DÙNG (dong-bo apNguon chọn từ `nguon`) */ giaNcc: number | null; tonNcc: number | null; tonKho: TonKho[]; nccMat: boolean; hetHang: boolean; hetTuDong: boolean; tonLuc: string | null; choCoHang: number;
  /** mọi nguồn của biến thể (bật trước, theo ưu tiên) · nguồn máy đang dùng · nguồn đó bán được không */ nguon: NguonDong[]; nguonId: number | null; nguonOk: boolean | null };
export type TonKho = { kho: string; nuoc: string; so: number };
/** Một nguồn của một biến thể shop (shop_nguon) kèm ảnh biến thể NCC + sản phẩm NCC. */
export type NguonDong = { id: number; uuTien: number; kiemMau: boolean; bat: boolean; ghiChu: string | null;
  nccBtId: number; nccSpId: number; ncc: string; maSp: string; tenSp: string | null; dangBan: boolean | null;
  maBt: string; tenBt: string | null; gia: number | null; ton: number | null; tonKho: TonKho[]; tonLuc: string | null; mat: boolean };
/** Danh mục NCC dùng chung mọi shop (shop_ncc_sp → shop_ncc_bt). */
export type NccSpDong = { id: number; ncc: string; ma: string; ten: string | null; link: string | null; dangBan: boolean | null; luc: string | null; loi: string | null;
  info: { sku?: string; listed?: number | null; video?: string[]; chi_tiet?: { danh_muc: string | null; loai: string | null; can_nang: string | null; can_dong_goi: string | null; chat_lieu: string | null;
    dong_goi: string | null; gia_goi_y: number | null; tao_luc: string | null; anh: string[]; mo_ta: string } };
  bt: NccBtDong[] };
export type NccBtDong = { id: number; ma: string; ten: string | null; sku: string | null; gia: number | null; ton: number | null; tonKho: TonKho[]; tonLuc: string | null; mat: boolean;
  info: { anh?: string | null; can?: number | null; kich?: string | null; gia_goi_y?: number | null } };
export type SanPhamDong = { id: number; cuaHang: string; domain: string; slug: string | null; ten: string; tieuDe: string | null; anh: string | null;
  giaGoc: number | null; giaTu: number | null; hien: boolean; soBienThe: number; daBan: number; danhGia: number;
  thamKhao: ThamKhao[]; video: string[]; choCoHang: number;
  /** các SẢN PHẨM NCC đang làm nguồn cho biến thể của sản phẩm này (suy từ nguồn bật), sản phẩm của nguồn chính đứng trước */ nguonSp: NguonSp[] };
export type NguonSp = { id: number; ncc: string; ma: string; ten: string | null; dangBan: boolean | null; /** số biến thể shop lấy nó làm nguồn chính */ chinh: number; /** … làm dự phòng */ duPhong: number };
export type ThamKhao = { url: string | null; nguon: string; ghi_chu: string; khop: 'chua_xac_nhan' | 'dung_mau' | 'khac'; luc: string };
export type DanhGiaDong = { id: number; cuaHang: string; sanPham: string; ten: string; email: string | null; sao: number; tieuDe: string | null; noiDung: string;
  daMua: boolean; trangThai: string; taoLuc: string };
export type CuaHangDong = { id: number; khoa: string; ten: string; domain: string; nenTang: string; ncc: string; trangThai: string; tenMien: string[]; matTien: MatTien;
  cauHinh: { ngay_ship_max?: number; tu_sang_ncc?: boolean; tu_tra_ncc?: boolean; quoc_gia_kho?: string; ga4_property?: string; tu_an_het?: boolean; bien_toi_thieu?: number; ton_thap?: number };
  dongBoLuc: string | null; dongBoLoi: string | null; soDon: number; soSanPham: number; thieuMa: number };

export async function docShop() {
  const [don, bt, ch, sps, dgs, ng, dmSp, dmBt] = await Promise.all([
    q(sql`
      SELECT d.id, c.khoa, c.nen_tang, c.domain, d.ma_ngoai, d.so_don, d.trang_thai_shop, d.khach, d.dia_chi, d.tong, d.hoan, d.tao_luc::text AS tao_luc, d.tra_luc::text AS tra_luc, d.sid, d.phi_cong,
             (SELECT COALESCE(SUM(m.sl), 0) FROM shop_don_mon m WHERE m.don_id = d.id) AS so_mon,
             (SELECT string_agg(m.ten || CASE WHEN m.sl > 1 THEN ' ×' || m.sl ELSE '' END, ' + ' ORDER BY m.id) FROM shop_don_mon m WHERE m.don_id = d.id) AS ten_mon,
             (SELECT SUM(b.gia_von * m.sl) FROM shop_don_mon m JOIN shop_bien_the b ON b.id = m.bien_the_id WHERE m.don_id = d.id) AS gia_von,
             n.ncc AS ncc_nha, n.ma_ncc, n.trang_thai AS ncc_tt, n.da_tra, n.tuyen, n.so_ngay, n.phi_ship, n.tien_hang, n.ma_van_don, n.hang_van_chuyen, n.gui_luc::text AS gui_luc,
             n.giao_luc::text AS giao_luc, n.van_don->>'trackingStatus' AS van_don, n.loi,
             n.created_at::text AS ncc_tao, n.tra_luc::text AS ncc_tra_luc, n.moc, n.tt_vd
        FROM shop_don d JOIN shop_cua_hang c ON c.id = d.cua_hang_id
        LEFT JOIN LATERAL (SELECT * FROM shop_don_ncc x WHERE x.don_id = d.id ORDER BY (x.trang_thai IN ('CANCELLED', 'LOI')), x.id DESC LIMIT 1) n ON true
       WHERE d.tao_luc > now() - interval '120 days'
       ORDER BY d.tao_luc DESC`),
    q(sql`
      SELECT b.id, b.san_pham_id, p.ten AS san_pham, p.anh, p.link, c.khoa, b.ma_ngoai, b.ten, b.sku, b.gia_ban, b.ma_ncc, b.gia_von,
             b.gia_ncc, b.ton_ncc, b.ton_kho, b.ncc_mat, b.het_hang, b.het_tu_dong, b.ton_luc::text AS ton_luc, b.nguon_id, b.nguon_ok,
             (SELECT COUNT(*) FROM shop_bao_co_hang k WHERE k.bien_the_id = b.id AND k.da_bao IS NULL) AS cho_co_hang,
             (SELECT COALESCE(SUM(m.sl), 0) FROM shop_don_mon m JOIN shop_don d ON d.id = m.don_id
               WHERE m.bien_the_id = b.id AND d.tra_luc IS NOT NULL AND d.trang_thai_shop NOT IN ('cancelled', 'refunded')) AS da_ban
        FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id
       ORDER BY p.ten, b.id`),
    q(sql`
      SELECT c.id, c.khoa, c.ten, c.domain, c.nen_tang, c.ncc, c.trang_thai, c.cau_hinh, c.ten_mien, c.mat_tien, c.dong_bo_luc::text AS dong_bo_luc, c.dong_bo_loi,
             (SELECT COUNT(*) FROM shop_don d WHERE d.cua_hang_id = c.id) AS so_don,
             (SELECT COUNT(*) FROM shop_san_pham p WHERE p.cua_hang_id = c.id) AS so_sp,
             (SELECT COUNT(*) FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id WHERE p.cua_hang_id = c.id AND b.ma_ncc IS NULL) AS thieu_ma
        FROM shop_cua_hang c ORDER BY c.id`),
    q(sql`
      SELECT p.id, c.khoa, c.domain, p.slug, p.ten, p.tieu_de, p.anh, p.gia_goc, p.hien, p.tham_khao, p.video,
             (SELECT COUNT(*) FROM shop_bao_co_hang k WHERE k.san_pham_id = p.id AND k.da_bao IS NULL) AS cho_co_hang,
             (SELECT MIN(b.gia_ban) FROM shop_bien_the b WHERE b.san_pham_id = p.id) AS gia_tu,
             (SELECT COUNT(*) FROM shop_bien_the b WHERE b.san_pham_id = p.id) AS so_bt,
             (SELECT COALESCE(SUM(m.sl), 0) FROM shop_don_mon m JOIN shop_don d ON d.id = m.don_id JOIN shop_bien_the b ON b.id = m.bien_the_id
               WHERE b.san_pham_id = p.id AND d.tra_luc IS NOT NULL AND d.trang_thai_shop NOT IN ('cancelled', 'refunded')) AS da_ban,
             (SELECT COUNT(*) FROM shop_danh_gia g WHERE g.san_pham_id = p.id AND g.trang_thai = 'hien') AS so_dg
        FROM shop_san_pham p JOIN shop_cua_hang c ON c.id = p.cua_hang_id ORDER BY c.id, p.thu_tu, p.id`),
    q(sql`
      SELECT g.id, c.khoa, p.ten AS san_pham, g.ten, g.email, g.sao, g.tieu_de, g.noi_dung, g.don_id IS NOT NULL AS da_mua, g.trang_thai, g.tao_luc::text AS tao_luc
        FROM shop_danh_gia g JOIN shop_san_pham p ON p.id = g.san_pham_id JOIN shop_cua_hang c ON c.id = g.cua_hang_id
       ORDER BY (g.trang_thai = 'cho') DESC, g.tao_luc DESC LIMIT 500`),
    q(sql`
      SELECT n.id, n.bien_the_id, n.uu_tien, n.kiem_mau, n.bat, n.ghi_chu, n.ncc_bt_id, t.ncc_sp_id, s.ncc, s.ma AS ma_sp, s.ten AS ten_sp, s.dang_ban,
             t.ma AS ma_bt, t.ten AS ten_bt, t.gia, t.ton, t.ton_kho, t.ton_luc::text AS ton_luc, t.mat
        FROM shop_nguon n JOIN shop_ncc_bt t ON t.id = n.ncc_bt_id JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id
       ORDER BY n.bien_the_id, n.bat DESC, n.uu_tien, n.id`),
    q(sql`SELECT id, ncc, ma, ten, link, info, dang_ban, luc::text AS luc, loi FROM shop_ncc_sp ORDER BY ncc, ten NULLS LAST, id`),
    q(sql`SELECT id, ncc_sp_id, ma, ten, sku, gia, info, ton, ton_kho, ton_luc::text AS ton_luc, mat FROM shop_ncc_bt ORDER BY ncc_sp_id, ten NULLS LAST, id`),
  ]);
  const nguonTheoBt = new Map<number, NguonDong[]>();
  for (const r of ng) {
    const x: NguonDong = { id: Number(r.id), uuTien: Number(r.uu_tien), kiemMau: !!r.kiem_mau, bat: !!r.bat, ghiChu: (r.ghi_chu as string) ?? null,
      nccBtId: Number(r.ncc_bt_id), nccSpId: Number(r.ncc_sp_id), ncc: String(r.ncc), maSp: String(r.ma_sp), tenSp: (r.ten_sp as string) ?? null, dangBan: r.dang_ban == null ? null : !!r.dang_ban,
      maBt: String(r.ma_bt), tenBt: (r.ten_bt as string) ?? null, gia: so(r.gia), ton: so(r.ton), tonKho: (r.ton_kho as TonKho[]) ?? [], tonLuc: (r.ton_luc as string) ?? null, mat: !!r.mat };
    const k = Number(r.bien_the_id);
    nguonTheoBt.set(k, [...(nguonTheoBt.get(k) ?? []), x]);
  }
  const btTheoSp = new Map<number, NccBtDong[]>();
  for (const r of dmBt) {
    const k = Number(r.ncc_sp_id);
    btTheoSp.set(k, [...(btTheoSp.get(k) ?? []), { id: Number(r.id), ma: String(r.ma), ten: (r.ten as string) ?? null, sku: (r.sku as string) ?? null, gia: so(r.gia),
      ton: so(r.ton), tonKho: (r.ton_kho as TonKho[]) ?? [], tonLuc: (r.ton_luc as string) ?? null, mat: !!r.mat, info: (r.info ?? {}) as NccBtDong['info'] }]);
  }
  const danhMuc: NccSpDong[] = dmSp.map((r) => ({ id: Number(r.id), ncc: String(r.ncc), ma: String(r.ma), ten: (r.ten as string) ?? null, link: (r.link as string) ?? null,
    dangBan: r.dang_ban == null ? null : !!r.dang_ban, luc: (r.luc as string) ?? null, loi: (r.loi as string) ?? null, info: (r.info ?? {}) as NccSpDong['info'], bt: btTheoSp.get(Number(r.id)) ?? [] }));
  const bayGio = Date.now();
  const dons: DonDong[] = don.map((r) => {
    const k = (r.khach ?? {}) as Record<string, string>, dc = (r.dia_chi ?? {}) as Record<string, string>;
    const ncc = r.ncc_tt ? { nha: String(r.ncc_nha ?? 'cj'), maNcc: (r.ma_ncc as string) ?? null, trangThai: String(r.ncc_tt), daTra: !!r.da_tra, tuyen: (r.tuyen as string) ?? null,
      soNgay: (r.so_ngay as string) ?? null, maVanDon: (r.ma_van_don as string) ?? null, hang: (r.hang_van_chuyen as string) ?? null,
      guiLuc: (r.gui_luc as string) ?? null, giaoLuc: (r.giao_luc as string) ?? null, vanDon: (r.van_don as string) ?? null, loi: (r.loi as string) ?? null,
      tienHang: so(r.tien_hang) } : null;
    const buoc = buocCua(String(r.trang_thai_shop), ncc && { trang_thai: ncc.trangThai, da_tra: ncc.daTra, ma_van_don: ncc.maVanDon, gui_luc: ncc.guiLuc, giao_luc: ncc.giaoLuc, so_ngay: ncc.soNgay }, bayGio);
    const songNcc = ncc && !['CANCELLED', 'LOI', 'TRASH'].includes(ncc.trangThai);
    const ht = buoc === 'cho_tt' || buoc === 'huy' ? null : hanhTrinh({ nhanLuc: String(r.tra_luc ?? r.tao_luc), nccTaoLuc: songNcc ? (r.ncc_tao as string) : null,
      nccTt: songNcc ? ncc.trangThai : null, daTra: !!(songNcc && ncc.daTra), traNccLuc: songNcc ? (r.ncc_tra_luc as string) ?? null : null,
      guiLuc: songNcc ? ncc.guiLuc : null, giaoLuc: songNcc ? ncc.giaoLuc : null, moc: songNcc ? (r.moc as Moc[] | null) : null,
      ttVd: songNcc ? (r.tt_vd as string) ?? null : null, nuocKhach: dc.nuoc || 'US' });
    const tong = Number(r.tong), hoan = Number(r.hoan), gv = so(r.gia_von), ship = ncc && ncc.trangThai !== 'LOI' ? so(r.phi_ship) : null;
    const phi = so(r.phi_cong) ?? Math.round((tong * 0.029 + 0.3) * 100) / 100;
    return {
      id: Number(r.id), cuaHang: String(r.khoa), nenTang: String(r.nen_tang), domain: String(r.domain), maNgoai: String(r.ma_ngoai), soDon: String(r.so_don), trangThaiShop: String(r.trang_thai_shop),
      buoc,
      khach: k.ten ?? '', email: k.email ?? '', nuoc: dc.nuoc ?? '', bang: dc.bang ?? '', tong, hoan, taoLuc: String(r.tao_luc), sid: (r.sid as string) ?? null,
      soMon: Number(r.so_mon), tenMon: String(r.ten_mon ?? ''), giaVon: gv, shipNcc: ship, phiCong: phi,
      lai: gv === null ? null : Math.round((tong - hoan - gv - (ship ?? 0) - phi) * 100) / 100,
      ncc, ht,
    };
  });
  const bienThe: BienTheDong[] = bt.map((r) => ({ id: Number(r.id), sanPhamId: Number(r.san_pham_id), sanPham: String(r.san_pham), anh: (r.anh as string) ?? null,
    link: (r.link as string) ?? null, cuaHang: String(r.khoa), maNgoai: String(r.ma_ngoai), ten: String(r.ten), sku: (r.sku as string) ?? null,
    giaBan: so(r.gia_ban), maNcc: (r.ma_ncc as string) ?? null, giaVon: so(r.gia_von), daBan: Number(r.da_ban),
    giaNcc: so(r.gia_ncc), tonNcc: so(r.ton_ncc), tonKho: (r.ton_kho as BienTheDong['tonKho']) ?? [], nccMat: !!r.ncc_mat, hetHang: !!r.het_hang, hetTuDong: !!r.het_tu_dong, tonLuc: (r.ton_luc as string) ?? null, choCoHang: Number(r.cho_co_hang),
    nguon: nguonTheoBt.get(Number(r.id)) ?? [], nguonId: so(r.nguon_id), nguonOk: r.nguon_ok == null ? null : !!r.nguon_ok }));
  // sản phẩm NCC làm nguồn cho từng sản phẩm shop: đếm theo vai (chính = ưu tiên nhỏ nhất trong nguồn bật của biến thể)
  const nguonSpTheoSp = new Map<number, Map<number, NguonSp>>();
  for (const b of bienThe) {
    const bat = b.nguon.filter((n) => n.bat);
    for (const [i, n] of bat.entries()) {
      const m = nguonSpTheoSp.get(b.sanPhamId) ?? new Map<number, NguonSp>();
      const x = m.get(n.nccSpId) ?? { id: n.nccSpId, ncc: n.ncc, ma: n.maSp, ten: n.tenSp, dangBan: n.dangBan, chinh: 0, duPhong: 0 };
      if (i === 0) x.chinh++; else x.duPhong++;
      m.set(n.nccSpId, x); nguonSpTheoSp.set(b.sanPhamId, m);
    }
  }
  const cuaHang: CuaHangDong[] = ch.map((r) => ({ id: Number(r.id), khoa: String(r.khoa), ten: String(r.ten), domain: String(r.domain), nenTang: String(r.nen_tang),
    ncc: String(r.ncc), trangThai: String(r.trang_thai), cauHinh: (r.cau_hinh ?? {}) as CuaHangDong['cauHinh'], dongBoLuc: (r.dong_bo_luc as string) ?? null,
    dongBoLoi: (r.dong_bo_loi as string) ?? null, soDon: Number(r.so_don), soSanPham: Number(r.so_sp), thieuMa: Number(r.thieu_ma),
    tenMien: (r.ten_mien as string[]) ?? [], matTien: (r.mat_tien ?? {}) as MatTien }));
  const sanPham: SanPhamDong[] = sps.map((r) => ({ id: Number(r.id), cuaHang: String(r.khoa), domain: String(r.domain), slug: (r.slug as string) ?? null, ten: String(r.ten),
    tieuDe: (r.tieu_de as string) ?? null, anh: (r.anh as string) ?? null, giaGoc: so(r.gia_goc), giaTu: so(r.gia_tu), hien: !!r.hien, soBienThe: Number(r.so_bt),
    daBan: Number(r.da_ban), danhGia: Number(r.so_dg), thamKhao: (r.tham_khao as ThamKhao[]) ?? [], video: (r.video as string[]) ?? [], choCoHang: Number(r.cho_co_hang),
    nguonSp: [...(nguonSpTheoSp.get(Number(r.id))?.values() ?? [])].sort((a, b) => b.chinh - a.chinh) }));
  const danhGia: DanhGiaDong[] = dgs.map((r) => ({ id: Number(r.id), cuaHang: String(r.khoa), sanPham: String(r.san_pham), ten: String(r.ten), email: (r.email as string) ?? null,
    sao: Number(r.sao), tieuDe: (r.tieu_de as string) ?? null, noiDung: String(r.noi_dung), daMua: !!r.da_mua, trangThai: String(r.trang_thai), taoLuc: String(r.tao_luc) }));
  return { don: dons, bienThe, cuaHang, sanPham, danhGia, danhMuc };
}

export type SuKien = { ts: string; nguon: string; noiDung: string; loi: boolean };
export type ChiTietDon = { don: DonDong | null; diaChi: Record<string, string>; sdt: string; mon: { ten: string; sl: number; gia: number; maNcc: string | null; giaVon: number | null; bienTheId: number | null }[];
  suKien: SuKien[]; nccCu: { maNcc: string | null; trangThai: string; loi: string | null; ts: string }[]; vanDonRaw: unknown;
  /** Hành trình đầy đủ (17TRACK, KHÔNG che tên chặng ngoài — bản nội bộ) + chặng cuối. */
  moc: Moc[]; changCuoi: string | null };

export async function docChiTietDon(id: number): Promise<ChiTietDon> {
  const { don } = await docShop();
  const d = don.find((x) => x.id === id) ?? null;
  const [goc] = await q(sql`SELECT dia_chi, khach FROM shop_don WHERE id = ${id}`);
  const [mon, sk, nccCu, vd] = await Promise.all([
    q(sql`SELECT m.ten, m.sl, m.gia, b.ma_ncc, b.gia_von, m.bien_the_id FROM shop_don_mon m LEFT JOIN shop_bien_the b ON b.id = m.bien_the_id WHERE m.don_id = ${id} ORDER BY m.id`),
    q(sql`SELECT ts::text AS ts, nguon, noi_dung, loi FROM shop_su_kien WHERE don_id = ${id} ORDER BY ts DESC, id DESC`),
    q(sql`SELECT ma_ncc, trang_thai, loi, created_at::text AS ts FROM shop_don_ncc WHERE don_id = ${id} ORDER BY id DESC`),
    q(sql`SELECT van_don, moc, ma_chang_cuoi, hang_chang_cuoi FROM shop_don_ncc WHERE don_id = ${id} AND trang_thai NOT IN ('CANCELLED', 'LOI') ORDER BY id DESC LIMIT 1`),
  ]);
  return {
    don: d, diaChi: ((goc?.dia_chi ?? {}) as Record<string, string>), sdt: String(((goc?.khach ?? {}) as Record<string, string>).sdt ?? ''),
    mon: mon.map((r) => ({ ten: String(r.ten), sl: Number(r.sl), gia: Number(r.gia), maNcc: (r.ma_ncc as string) ?? null, giaVon: so(r.gia_von), bienTheId: so(r.bien_the_id) })),
    suKien: sk.map((r) => ({ ts: String(r.ts), nguon: String(r.nguon), noiDung: String(r.noi_dung), loi: !!r.loi })),
    nccCu: nccCu.map((r) => ({ maNcc: (r.ma_ncc as string) ?? null, trangThai: String(r.trang_thai), loi: (r.loi as string) ?? null, ts: String(r.ts) })),
    vanDonRaw: vd[0]?.van_don ?? null,
    moc: (vd[0]?.moc as Moc[] | null) ?? [],
    changCuoi: vd[0]?.ma_chang_cuoi ? `${vd[0]?.hang_chang_cuoi ?? ''} ${vd[0]?.ma_chang_cuoi}`.trim() : null,
  };
}
