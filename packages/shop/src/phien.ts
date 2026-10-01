// SHOP — PHỄU của một phiên khách trên mặt tiền: một bộ chặng cho cả nơi ghi (apps/store /api/phien) lẫn nơi xem (/shop › Khách trực
// tiếp). Chặng lưu bằng SỐ THỨ TỰ trong mảng (shop_phien.chang) để máy chủ chỉ cần GREATEST — thêm chặng mới thì chèn đúng vị trí
// rồi đổi số trong sổ cũ, đừng đảo thứ tự.

export const CHANG_PHIEN = [
  { key: 'vao', nhan: 'Vào site', chuThich: 'Mở một trang bất kỳ của shop.' },
  { key: 'xem_sp', nhan: 'Xem sản phẩm', chuThich: 'Mở trang một sản phẩm.' },
  { key: 'chon', nhan: 'Chọn mẫu/size', chuThich: 'Bấm chọn màu/size trên trang sản phẩm.' },
  { key: 'them_gio', nhan: 'Thêm giỏ', chuThich: 'Bấm Add to cart.' },
  { key: 'checkout', nhan: 'Vào checkout', chuThich: 'Mở trang thanh toán (giỏ có hàng).' },
  { key: 'nhap_tt', nhan: 'Điền thông tin', chuThich: 'Bắt đầu gõ vào form giao hàng (không lưu chữ khách gõ).' },
  { key: 'tra_tien', nhan: 'Bấm thanh toán', chuThich: 'Gửi form thẻ / bấm Apple Pay, Google Pay.' },
  { key: 'dat_hang', nhan: 'Đặt hàng', chuThich: 'Thanh toán thành công.' },
] as const;
export type KhoaPhien = (typeof CHANG_PHIEN)[number]['key'];
export const SO_CHANG: Record<string, number> = Object.fromEntries(CHANG_PHIEN.map((c, i) => [c.key, i]));

/** Sự kiện thương mại của bao() (GA4/Pixel) → chặng phễu. Một đường: mọi chỗ đang bắn GA4 tự vào sổ phiên. */
export const BAO_SANG_CHANG: Record<string, KhoaPhien> = {
  view_item: 'xem_sp', add_to_cart: 'them_gio', begin_checkout: 'checkout', add_payment_info: 'tra_tien', purchase: 'dat_hang',
};

/** Nhãn đọc được cho từng loại sự kiện (dòng thời gian trong drawer phiên). */
export const NHAN_SU_KIEN: Record<string, string> = {
  xem_trang: 'Xem trang', cuon: 'Cuộn', click: 'Bấm', mo_gio: 'Mở giỏ', roi: 'Rời trang',
  ...Object.fromEntries(CHANG_PHIEN.map((c) => [c.key, c.nhan])),
};

export const LA_BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|bingpreview|python|curl|wget|httpclient/i;
export const ONLINE_GIAY = 90;   // còn nhịp trong 90 giây = đang trên site (tab ẩn thì nhịp dừng)

/** Cửa sổ thời gian của màn Khách trực tiếp (client + máy chủ cùng đọc). */
export const CUA_SO = [
  { value: 'online', label: 'Đang online', title: `Còn nhịp trong ${ONLINE_GIAY} giây (tab đang mở và hiện)` },
  { value: '30p', label: '30 phút', title: 'Có hoạt động trong 30 phút qua — như GA4 thời gian thực' },
  { value: 'hom_nay', label: 'Hôm nay', title: 'Từ 00:00 giờ Việt Nam' },
  { value: '7n', label: '7 ngày' },
] as const;
export type CuaSo = (typeof CUA_SO)[number]['value'];
