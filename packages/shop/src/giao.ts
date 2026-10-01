// SHOP — GIAO HÀNG phía khách: ngày nhận dự kiến, cam kết giao hàng, tên chặng + lời giải thích trên trang theo dõi và thư theo chặng.
// Mục đích (anh chốt 01/10/2026): khách thấy đơn đang chạy và yên tâm khi chờ — như mua trên sàn: biết trước ngày, có cam kết, được
// cập nhật đều. File THUẦN (không DB/fs): trang sản phẩm, checkout (trình duyệt), trang cảm ơn, thư, trang theo dõi cùng đọc một bản.
// Số liệu phải KHỚP chính sách shop (mat_tien.trang orders-shipping): xử lý 1-3 ngày làm việc, giao 7-15 ngày làm việc, quá 30 ngày
// kể từ lúc gửi mà chưa tới thì gửi hàng mới hoặc hoàn đủ — đổi chính sách thì đổi mat_tien.giao, đừng sửa chữ ở từng chỗ.
import type { KhoaChang } from './hanh-trinh';

export type CauHinhGiao = { xu_ly: [number, number]; van_chuyen: [number, number]; ngay_lam_viec: boolean; dam_bao_ngay: number };
export const GIAO_MAC_DINH: CauHinhGiao = { xu_ly: [1, 3], van_chuyen: [7, 15], ngay_lam_viec: true, dam_bao_ngay: 30 };

export function cauHinhGiao(raw: unknown): CauHinhGiao {
  const g = (raw ?? {}) as Partial<CauHinhGiao>;
  return { ...GIAO_MAC_DINH, ...g };
}

/** Cộng n ngày (ngày làm việc thì bỏ thứ Bảy, Chủ nhật — không tính lễ). */
export function congNgay(tu: Date, n: number, lamViec: boolean): Date {
  const d = new Date(tu.getTime());
  let con = n;
  while (con > 0) { d.setUTCDate(d.getUTCDate() + 1); const t = d.getUTCDay(); if (!lamViec || (t !== 0 && t !== 6)) con--; }
  return d;
}

/** Khoảng ngày nhận dự kiến cho đơn đặt lúc `tu` (đã gửi hàng thì truyền daGui để chỉ cộng phần vận chuyển). */
export function duKienGiao(g: CauHinhGiao, tu = new Date(), daGui = false): { tu: Date; den: Date } {
  const [x0, x1] = daGui ? [0, 0] : g.xu_ly;
  return { tu: congNgay(tu, x0 + g.van_chuyen[0], g.ngay_lam_viec), den: congNgay(tu, x1 + g.van_chuyen[1], g.ngay_lam_viec) };
}

/** "Mon, Oct 13" — khách Mỹ; múi giờ New York để ngày không lệch theo máy chủ. */
export const ngayUS = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
export const khoangUS = (k: { tu: Date | string; den: Date | string }) => `${ngayUS(k.tu)} – ${ngayUS(k.den)}`;

/** Câu cam kết giao hàng — đúng chính sách "Lost or late packages". */
export const camKetGiao = (g: CauHinhGiao) =>
  `Delivery guarantee: if your order hasn't arrived within ${g.dam_bao_ngay} days of shipping, we'll send a replacement or refund you in full.`;

/** Tên chặng + lời giải thích cho KHÁCH (trang theo dõi, thư theo chặng). Không lộ nơi/hãng chặng ngoài. */
export const CHANG_KHACH: Record<KhoaChang, { nhan: string; giai_thich: string }> = {
  nhan_don: { nhan: 'Order confirmed', giai_thich: "We've received your order and payment." },
  sang_ncc: { nhan: 'Preparing your order', giai_thich: 'Your order is being picked and packed at our fulfillment center.' },
  tra_ncc: { nhan: 'Preparing your order', giai_thich: 'Your order is being picked and packed at our fulfillment center.' },
  gui_hang: { nhan: 'Shipped', giai_thich: 'Your package has left our fulfillment center. The first carrier scan usually shows up within 2-3 days.' },
  hang_nhan: { nhan: 'With the carrier', giai_thich: 'The carrier has your package and is getting it ready for international shipping.' },
  roi_nuoc: { nhan: 'On its way to the US', giai_thich: 'Your package is in international transit. Scans are often quiet during this leg - that is normal.' },
  den_nuoc: { nhan: 'Arrived in the US', giai_thich: 'Your package has reached the US and is moving through the domestic network to your local post office.' },
  di_giao: { nhan: 'Out for delivery', giai_thich: 'Your package is on the delivery vehicle and should arrive today.' },
  da_giao: { nhan: 'Delivered', giai_thich: 'Your package has been delivered. Enjoy!' },
};

/** Chặng nào thì gửi thư cho khách (thư "đã gửi hàng" có sẵn ở gui_hang). Thứ tự = thứ tự trong CHANG. */
export const CHANG_BAO_THU: KhoaChang[] = ['roi_nuoc', 'den_nuoc', 'di_giao', 'da_giao'];

/** Đơn đã QUÁ ngày dự kiến: nói thật là trễ, không bảo "bình thường" — chỉ hứa thứ shop làm thật (bảo đảm giao hàng). */
export const LOI_TRE = (g: CauHinhGiao) => `We're sorry - your package is taking longer than expected. Our team is checking on it. `
  + `If it hasn't arrived within ${g.dam_bao_ngay} days of shipping, we'll send a replacement or refund you in full. Questions? Contact us any time.`;

/** Lời trấn an khi vận đơn im lâu: chặng đang đi + đã im bao nhiêu ngày. null = không cần nói gì. Im quá 10 ngày thì không còn là
 *  "bình thường" — trả null để nơi gọi dùng LOI_TRE nếu đã quá ngày dự kiến. */
export function loiImLang(chang: KhoaChang, quetCuoi: string | null, bayGio = Date.now()): string | null {
  if (!quetCuoi || chang === 'da_giao' || chang === 'di_giao' || chang === 'nhan_don' || chang === 'sang_ncc' || chang === 'tra_ncc') return null;
  const ngay = Math.floor((bayGio - Date.parse(quetCuoi)) / 86_400_000);
  if (ngay < 3 || ngay > 10) return null;
  const tiep = chang === 'den_nuoc' ? 'the next scan usually appears when it reaches your local post office' : 'the next scan usually appears when it arrives in the US';
  return `No new scan for ${ngay} days. This is normal while your package is in transit - ${tiep}. We are keeping an eye on it for you.`;
}

// Tự kiểm: node_modules/.bin/tsx packages/shop/src/giao.ts
if (process.argv[1]?.endsWith('giao.ts')) {
  const thu6 = new Date('2026-10-02T15:00:00Z');                       // thứ Sáu
  if (congNgay(thu6, 1, true).getUTCDay() !== 1) throw new Error('ngày làm việc phải nhảy qua cuối tuần');
  const k = duKienGiao(GIAO_MAC_DINH, thu6);
  const ngay = (k.den.getTime() - k.tu.getTime()) / 86_400_000;
  if (ngay < 14 || ngay > 16) throw new Error(`khoảng 8-18 ngày làm việc ra ${ngay} ngày lịch`);
  if (!loiImLang('roi_nuoc', '2026-10-01T00:00:00Z', Date.parse('2026-10-05T00:00:00Z'))?.includes('4 days')) throw new Error('loiImLang');
  if (loiImLang('di_giao', '2026-09-01T00:00:00Z') !== null) throw new Error('đang phát thì không trấn an');
  if (loiImLang('roi_nuoc', '2026-09-01T00:00:00Z', Date.parse('2026-09-23T00:00:00Z')) !== null) throw new Error('im 22 ngày không được gọi là bình thường');
  console.log('giao: 5/5 ok ·', khoangUS(k));
}
