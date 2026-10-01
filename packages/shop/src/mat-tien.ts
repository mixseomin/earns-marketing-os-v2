// Cấu hình MẶT TIỀN của một cửa hàng (shop_cua_hang.mat_tien). Khuôn trang là MỘT (apps/store, clone Crossian) — mỗi shop chỉ khác ở đây.
// Luật số liệu: mọi con số khách nhìn thấy phải CÓ THẬT — giá gạch chỉ khi có giá trước giảm thật, đếm ngược chỉ khi đợt sale có ngày
// hết thật, "N left" chỉ khi tồn kho thật dưới ngưỡng, "N people viewing" là số người đang xem thật, đánh giá là đánh giá thật.

export type BacGiam = { sl: number; pt: number };          // tổng số món ≥ sl → giảm pt% cả giỏ
export type TrangTinh = { tieu_de: string; html: string };

export type MatTien = {
  logo?: string | null;                 // URL ảnh logo; không có thì dựng chữ tên shop
  thanh_tren?: string;                  // dải đen trên cùng
  mau_nhan?: string;                    // màu nút chọn / nhấn (Crossian: #4A90E2)
  dia_chi?: string;                     // địa chỉ chân trang
  email?: string;                       // hộp thư hỗ trợ (gửi + nhận)
  bac_giam?: BacGiam[];                 // mua nhiều giảm nhiều
  ship?: { phi: number; mien_phi_tu?: number | null; ten?: string };
  sale_het?: string | null;             // ISO — ngày hết đợt sale có thật; trống = ẩn đếm ngược
  ton_hien_duoi?: number;               // hiện "Only N left" khi tồn ≤ ngưỡng
  do?: { ga4?: string; meta_pixel?: string; gads?: string; gads_nhan?: string };
  trang?: Record<string, TrangTinh>;    // /static/<khoá>: exchanges-returns · orders-shipping · privacy · terms-of-service
  dong_sale?: string;                   // khối đỏ/cam giữa cột mua, 2 dòng cách nhau \n — chỉ ghi ưu đãi CÓ THẬT
  cam_ket?: string[];
  faq?: { hoi: string; dap: string }[];  // khối FAQ cuối trang sản phẩm (khuôn orabra) — trả lời đúng chính sách shop
  ma_giam?: { ma: string; pt: number }[]; // mã giảm áp ở checkout (vd mã tặng khi đăng ký nhận tin)
  dang_ky?: { tieu_de: string; chu: string; ma: string } | null; // ô đăng ký chân trang: tặng mã nào                   // 3 ô cam kết dưới nút mua (ship, đổi trả, thanh toán) — đúng chính sách shop
};

export const TRANG_TINH = [
  { khoa: 'exchanges-returns', ten: 'Exchanges & Returns' },
  { khoa: 'orders-shipping', ten: 'Order & Shipping' },
  { khoa: 'terms-of-service', ten: 'Terms of Service' },
  { khoa: 'privacy', ten: 'Privacy Policy' },
] as const;

export function matTien(raw: unknown): Required<Pick<MatTien, 'bac_giam' | 'ship' | 'ton_hien_duoi' | 'trang' | 'do'>> & MatTien {
  const m = (raw ?? {}) as MatTien;
  return {
    ...m,
    bac_giam: [...(m.bac_giam ?? [])].sort((a, b) => a.sl - b.sl),
    ship: m.ship ?? { phi: 0, ten: 'Free Shipping' },
    ton_hien_duoi: m.ton_hien_duoi ?? 50,
    trang: m.trang ?? {},
    do: m.do ?? {},
  };
}

/** Tên biến môi trường theo cửa hàng: SHOP_<KHOA>_<DUOI> (khoá API không nằm trong DB). */
/** % giảm của một mã (không phân biệt hoa thường); mã lạ → 0. */
export const ptMa = (m: MatTien, ma: string | null | undefined) => (ma ? m.ma_giam?.find((x) => x.ma.toUpperCase() === ma.trim().toUpperCase())?.pt ?? 0 : 0);

export const tenEnv = (khoa: string, duoi: string) => `SHOP_${khoa.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${duoi}`;
export const envShop = (khoa: string, duoi: string) => process.env[tenEnv(khoa, duoi)] ?? '';
