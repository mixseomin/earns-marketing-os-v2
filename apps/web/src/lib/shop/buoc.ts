import { APP_TZ } from '@/lib/local-day';

// SHOP — BƯỚC của một đơn trên đường đi (dùng chung máy chủ + trình duyệt). Một hàm duy nhất suy bước từ trạng thái Woo
// + đơn NCC, để danh sách, ô lọc, dải số và drawer không mỗi chỗ tự đoán một kiểu.

export type Buoc = 'cho_tt' | 'cho_ncc' | 'loi_ncc' | 'cho_tra' | 'ncc_xu_ly' | 'dang_giao' | 'tre' | 'da_giao' | 'huy';

export const BUOC: { key: Buoc; nhan: string; chuThich: string; mau: 'muted' | 'warn' | 'bad' | 'ok' }[] = [
  { key: 'cho_ncc', nhan: 'Chờ sang NCC', chuThich: 'Khách đã trả tiền, chưa có đơn bên nhà cung cấp. Nhịp máy (10 phút) tự đặt nếu cửa hàng bật "tự sang NCC".', mau: 'warn' },
  { key: 'loi_ncc', nhan: 'Lỗi NCC', chuThich: 'Đặt sang nhà cung cấp bị lỗi (thiếu mã biến thể, không có tuyến ship, CJ từ chối…). Mở đơn đọc lỗi, sửa rồi bấm Sang NCC.', mau: 'bad' },
  { key: 'cho_tra', nhan: 'Chờ trả NCC', chuThich: 'Đơn CJ đã tạo nhưng CHƯA thanh toán — CJ chưa xử lý. Trả bằng nút trong đơn (trừ ví CJ) hoặc trên trang CJ.', mau: 'warn' },
  { key: 'ncc_xu_ly', nhan: 'NCC đang xử lý', chuThich: 'Đã trả CJ, chờ CJ đóng gói và cấp mã vận đơn.', mau: 'muted' },
  { key: 'dang_giao', nhan: 'Đang giao', chuThich: 'Có mã vận đơn, khách đã được báo, hàng đang trên đường.', mau: 'muted' },
  { key: 'tre', nhan: 'Giao trễ', chuThich: 'Đã gửi quá số ngày tối đa của tuyến mà chưa giao — dễ thành khiếu nại/dispute, nên nhắn khách trước.', mau: 'bad' },
  { key: 'da_giao', nhan: 'Đã giao', chuThich: 'Hãng vận chuyển báo đã giao.', mau: 'ok' },
  { key: 'cho_tt', nhan: 'Chưa trả tiền', chuThich: 'Đơn Woo chưa thanh toán xong (pending / on-hold / failed) — chưa làm gì.', mau: 'muted' },
  { key: 'huy', nhan: 'Huỷ / hoàn', chuThich: 'Đơn đã huỷ hoặc hoàn tiền toàn bộ.', mau: 'muted' },
];
export const NHAN_BUOC = Object.fromEntries(BUOC.map((b) => [b.key, b.nhan])) as Record<Buoc, string>;

export type NccTom = { trang_thai: string; da_tra: boolean; ma_van_don: string | null; gui_luc: string | null; giao_luc: string | null; so_ngay: string | null } | null;

export function buocCua(trangThaiShop: string, ncc: NccTom, bayGio = Date.now()): Buoc {
  if (['cancelled', 'refunded'].includes(trangThaiShop)) return 'huy';
  if (['pending', 'on-hold', 'failed', 'checkout-draft'].includes(trangThaiShop)) return 'cho_tt';
  if (!ncc || ncc.trang_thai === 'CANCELLED') return 'cho_ncc';
  if (ncc.trang_thai === 'LOI') return 'loi_ncc';
  if (ncc.giao_luc || ncc.trang_thai === 'DELIVERED') return 'da_giao';
  if (ncc.ma_van_don) {
    const toiDa = Math.max(...(String(ncc.so_ngay ?? '').match(/\d+/g) ?? ['20']).map(Number));
    // +3 ngày: vận đơn hiện trước khi hàng thật sự rời kho
    return ncc.gui_luc && bayGio - new Date(isoCua(ncc.gui_luc)).getTime() > (toiDa + 3) * 86_400_000 ? 'tre' : 'dang_giao';
  }
  if (!ncc.da_tra) return 'cho_tra';
  return 'ncc_xu_ly';
}

/* ── Định dạng dùng chung cho mọi màn shop (máy chủ + trình duyệt) ── */
export const tien = (x: number | null | undefined) => (x === null || x === undefined ? '—' : (x < 0 ? '-$' : '$') + Math.abs(x).toFixed(2));
/** Mốc giờ Postgres/ISO → "14:05 01/10" giờ Việt Nam (luật chung: nói với anh bằng GMT+7). */
export const isoCua = (s: string) => (s.includes('T') ? s : s.replace(' ', 'T')).replace(/([+-]\d\d)$/, '$1:00');
export function gio(s: string | null | undefined) {
  if (!s) return '—';
  const d = new Date(isoCua(s));
  if (Number.isNaN(d.getTime())) return '—';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hour12: false })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.hour}:${p.minute} ${p.day}/${p.month}`;
}
export const soNgayTu = (s: string | null | undefined) => (s ? Math.floor((Date.now() - new Date(isoCua(s)).getTime()) / 86_400_000) : null);
export const linkVanDon = (ma: string) => `https://t.17track.net/en#nums=${encodeURIComponent(ma)}`;
export const LINK_DS_CJ = 'https://www.cjdropshipping.com/mine/dropshipping/orderList?orderType=3&childType=1';

/** KÊNH NCC — tầng trên của cây nguồn hàng (shop_ncc.kenh). Một bản cho server action (kiểm khoá) + màn (nhãn). */
export const KENH_NCC: Record<string, { ten: string; chu: string }> = {
  cj: { ten: 'CJ Dropshipping', chu: 'CJ là một NCC: mình đặt, trả tiền, khiếu nại với CJ; CJ lấy hàng từ xưởng, kiểm, gửi.' },
  alibaba: { ten: 'Alibaba', chu: 'Mỗi nhà bán là một NCC riêng.' },
  '1688': { ten: '1688', chu: 'Mỗi nhà bán là một NCC riêng (thường cần agent mua hộ).' },
  aliexpress: { ten: 'AliExpress', chu: 'Mỗi cửa hàng là một NCC riêng.' },
  xuong: { ten: 'Xưởng riêng', chu: 'Làm việc thẳng với xưởng.' },
  khac: { ten: 'Khác', chu: '' },
};

/** ĐỐI THỦ (migration 0206) — nhãn dùng chung server action (kiểm khoá) + màn. */
export const KENH_BAN: Record<string, string> = { dtc: 'Web riêng (DTC)', amazon: 'Amazon', walmart: 'Walmart', aliexpress: 'AliExpress', temu: 'Temu', tiktok_shop: 'TikTok Shop', khac: 'Khác' };
export const KHOP_DOI_THU: Record<string, [string, 'ok' | 'warn' | 'muted']> = {
  dung_mau: ['cùng mẫu (đã so ảnh)', 'ok'], gan: ['cùng loại', 'warn'], chua_xac_nhan: ['chưa so ảnh', 'muted'], khac: ['khác mẫu', 'muted'] };
export const DINH_DANG_QC: Record<string, string> = { video: 'Video', ugc_video: 'Video UGC', anh: 'Ảnh', carousel: 'Carousel', slideshow: 'Slideshow' };
export const NEN_TANG_QC: Record<string, string> = { meta: 'Meta', tiktok: 'TikTok', google: 'Google', khac: 'Khác' };
/** Thư viện quảng cáo Meta của một Page (mọi QC đang chạy ở Mỹ) — chỉ dựng khi đã có Page ID thật. */
export const linkThuVienQc = (pageId: string | null) => (pageId && /^\d{5,}$/.test(pageId)
  ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&view_all_page_id=${pageId}` : null);

/** Tên biến thể → (màu, size) dù NCC viết size trước hay sau: "Dark Gray-36", "M-Black", "2XL-Dark Brown Leopard Print", "Advanced Black-75AB",
 *  "8814 Black-36", "Black / US 8". Phần nào trông như SIZE (chữ cỡ áo, số đo, cup) là size, phần còn lại là màu. Một bản cho mọi cây NCC/shop. */
const LA_SIZE = /^(?:\d?X{0,3}[SML]|\d?XL|X{1,4}L|\d{2,3}(?:[A-H]{1,3})?|[A-H]{1,2}\d{2}|(?:US|EU|UK) ?W?\d+(?:\.\d)?(?:\s*\/.*)?|\d+(?:\.\d)?|one ?size|free ?size)$/i;
export function tachBienThe(ten: string): { mau: string; co: string } {
  const t = ten.trim();
  const p = t.includes(' / ') ? t.split(' / ') : t.split('-');
  if (p.length < 2) return LA_SIZE.test(t) ? { mau: '', co: t } : { mau: t, co: '' };
  const dau = p[0]!.trim(), cuoi = p[p.length - 1]!.trim();
  if (LA_SIZE.test(cuoi)) return { mau: p.slice(0, -1).join(t.includes(' / ') ? ' / ' : '-').trim(), co: cuoi };
  if (LA_SIZE.test(dau)) return { mau: p.slice(1).join(t.includes(' / ') ? ' / ' : '-').trim(), co: dau };
  return { mau: t, co: '' };
}
