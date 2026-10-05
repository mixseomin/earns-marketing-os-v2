// SỔ TAB CẤP TRANG — MỘT nguồn cho cả thanh tab trong trang lẫn MENU bên trái (anh chốt 01/10/2026: mọi tab trong trang phải hiện
// lên menu, mở menu là đi thẳng tới tab đó). Trang nào có tab ghi URL (?tab=, <Tabs hrefFor=…>) thì KHAI Ở ĐÂY rồi dựng items bằng
// tabCua(); sidebar tự sinh mục con từ sổ này — không ai phải nhớ thêm mục menu bằng tay. Lưới: scripts/check-tab-trang.mjs
// (GHA + deploy.sh) chặn file nào có <Tabs hrefFor> mà không đọc sổ.
// File THƯỜNG (không 'use client'): server page + client component cùng import được giá trị thật.
import type { ReactNode } from 'react';

/** nhom: tab liền nhau cùng nhóm vẽ chung một cụm có nhãn (thanh tab + menu trái). */
export type TabTrang = { key: string; label: string; title?: string; nhom?: string };
/** mac: tab mặc định (URL trần) khi không phải tab đầu — thứ tự tab theo luồng, tab mở sẵn theo việc hằng ngày. */
type Trang = { param: string; mac?: string; tabs: readonly TabTrang[] };

export const TAB_TRANG = {
  '/': { param: 'tab', tabs: [
    { key: 'camp', label: 'Campaign', title: 'Mỗi dòng = một campaign: phễu + tiêu chí → phán xét' },
    { key: 'phu', label: 'Nền tảng phủ' },
    { key: 'nguon', label: 'Nguồn traffic' },
    { key: 'hatang', label: 'Lander & adapter' },
    { key: 'luat', label: 'Luật campaign', title: 'Thư viện luật điều hành campaign (be.adfond): kệ theo loại · nhắm · trọng số · tham số theo tầng' },
    { key: 'lenh', label: 'Lệnh MT5', title: 'Live Orders — forward-test mọi strategy (strategy-lab)' },
    { key: 'doanhthu', label: 'Doanh thu', title: 'Lịch tiền mọi nguồn · affiliate · Awin' },
    { key: 'taisan', label: 'Tài sản', title: 'Mọi thứ sinh tiền hoặc sắp sinh tiền: website · site Shopdy · shop → sản phẩm (đang làm → chờ duyệt → đang bán)' },
    { key: 'seo', label: 'SEO', title: 'Chỉ số nội bộ một site: GSC/Bing 30 ngày · truy vấn · Keyword Research · SteamSolo' },
    { key: 'email', label: 'Email', title: 'MailWizz · deliverability' },
    { key: 'duan', label: 'Dự án' },
  ] },
  // Xếp theo ĐƯỜNG ĐI CỦA KHÁCH (anh chốt 02/10/2026): quảng cáo kéo khách → khách trên site → đặt đơn + trả tiền → sau bán;
  // rồi phía sau quầy: hàng + nguồn, thiết lập shop. Tab mặc định vẫn là Đơn hàng (việc vận hành hằng ngày) — `mac`.
  '/shop': { param: 'tab', mac: 'don', tabs: [
    { nhom: 'Quảng cáo', key: 'ha_tang', label: 'Hạ tầng QC', title: 'Bộ chạy quảng cáo của shop: người · BM · TK QC · thẻ · Trang · pixel — kiểm cô lập với dự án khác + checklist chuẩn bị chạy' },
    { nhom: 'Quảng cáo', key: 'doi_thu', label: 'Đối thủ', title: 'Ai đang bán cùng mẫu: trang đích, giá, quảng cáo đang chạy — theo từng sản phẩm của mình' },
    { nhom: 'Khách trên site', key: 'truc_tiep', label: 'Trực tiếp', title: 'Ai đang trên site: trang đang xem, cuộn %, bấm gì, tới bước nào của phễu mua (kiểu GA4 thời gian thực)' },
    { nhom: 'Khách trên site', key: 'tu_van', label: 'Tư vấn', title: 'Khách hỏi qua ô chat trên site: máy soạn → kiểm → tự gửi loại an toàn, loại nhạy cảm chờ anh duyệt' },
    { nhom: 'Đơn & tiền', key: 'don', label: 'Đơn hàng', title: 'Luồng đơn toàn cảnh + bảng đơn; lọc tới chặng vận chuyển thì bảng hiện cột vận đơn (gộp tab Vận chuyển cũ)' },
    { nhom: 'Đơn & tiền', key: 'thanh_toan', label: 'Cổng TT', title: 'Cổng thanh toán (Stripe…) của từng shop + sức khoẻ: tài khoản còn nhận/rút tiền, tỷ lệ dispute/hoàn/thất bại, cảnh báo gian lận, webhook' },
    { nhom: 'Sau bán', key: 'khach_ph', label: 'Phản hồi', title: 'Khách liên hệ, khiếu nại, đổi trả, hoàn tiền, dispute — luồng tin + trả lời email' },
    { nhom: 'Sau bán', key: 'danh_gia', label: 'Đánh giá', title: 'Review khách gửi — duyệt' },
    { nhom: 'Hàng & nguồn', key: 'san_pham', label: 'Sản phẩm', title: 'Cây sản phẩm → màu → biến thể → nguồn · mặt tiền' },
    { nhom: 'Hàng & nguồn', key: 'ncc', label: 'Nhà cung cấp', title: 'NCC: danh mục, biến động giá/tồn, trao đổi — hỏi, khiếu nại/dispute CJ, giục giao' },
    { nhom: 'Thiết lập', key: 'cua_hang', label: 'Shop', title: 'Cấu hình shop + mặt tiền' },
  ] },
} as const satisfies Record<string, Trang>;

export type DuongCoTab = keyof typeof TAB_TRANG;
export const coTab = (duong: string): duong is DuongCoTab => Object.prototype.hasOwnProperty.call(TAB_TRANG, duong);

/** Tab mặc định của trang: `mac` nếu có, không thì tab đầu. */
export function tabMacDinh(duong: DuongCoTab): string {
  const t: Trang = TAB_TRANG[duong];
  return t.mac ?? t.tabs[0]!.key;
}

/** Link tới một tab: tab mặc định = đường trần, URL sạch. */
export function hrefTab(duong: DuongCoTab, key: string): string {
  return key === tabMacDinh(duong) ? duong : `${duong}?${TAB_TRANG[duong].param}=${encodeURIComponent(key)}`;
}

/** Items cho <Tabs>: nhãn/tiêu đề từ sổ, badge do trang tính. */
export function tabCua<T extends string>(duong: DuongCoTab, badge: Partial<Record<T, ReactNode>> = {}): { key: T; label: string; title?: string; nhom?: string; badge?: ReactNode }[] {
  return TAB_TRANG[duong].tabs.map((t: TabTrang) => ({ key: t.key as T, label: t.label, title: t.title, nhom: t.nhom, badge: badge[t.key as T] }));
}
