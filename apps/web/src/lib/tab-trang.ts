// SỔ TAB CẤP TRANG — MỘT nguồn cho cả thanh tab trong trang lẫn MENU bên trái (anh chốt 01/10/2026: mọi tab trong trang phải hiện
// lên menu, mở menu là đi thẳng tới tab đó). Trang nào có tab ghi URL (?tab=, <Tabs hrefFor=…>) thì KHAI Ở ĐÂY rồi dựng items bằng
// tabCua(); sidebar tự sinh mục con từ sổ này — không ai phải nhớ thêm mục menu bằng tay. Lưới: scripts/check-tab-trang.mjs
// (GHA + deploy.sh) chặn file nào có <Tabs hrefFor> mà không đọc sổ.
// File THƯỜNG (không 'use client'): server page + client component cùng import được giá trị thật.
import type { ReactNode } from 'react';

export type TabTrang = { key: string; label: string; title?: string };
type Trang = { param: string; tabs: readonly TabTrang[] };

export const TAB_TRANG = {
  '/': { param: 'tab', tabs: [
    { key: 'camp', label: 'Campaign', title: 'Mỗi dòng = một campaign: phễu + tiêu chí → phán xét' },
    { key: 'phu', label: 'Nền tảng phủ' },
    { key: 'nguon', label: 'Nguồn traffic' },
    { key: 'hatang', label: 'Lander & adapter' },
    { key: 'luat', label: 'Luật campaign', title: 'Thư viện luật điều hành campaign (be.adfond): kệ theo loại · nhắm · trọng số · tham số theo tầng' },
    { key: 'lenh', label: 'Lệnh MT5', title: 'Live Orders — forward-test mọi strategy (strategy-lab)' },
    { key: 'doanhthu', label: 'Doanh thu', title: 'Lịch tiền mọi nguồn · affiliate · Awin' },
    { key: 'seo', label: 'SEO & sản phẩm', title: 'GSC · Gumroad · SteamSolo' },
    { key: 'email', label: 'Email', title: 'MailWizz · deliverability' },
    { key: 'duan', label: 'Dự án' },
  ] },
  '/shop': { param: 'tab', tabs: [
    { key: 'don', label: 'Đơn hàng', title: 'Luồng đơn toàn cảnh + bảng đơn' },
    { key: 'van_chuyen', label: 'Vận chuyển', title: 'Đơn ở NCC / trên đường' },
    { key: 'san_pham', label: 'Sản phẩm', title: 'Biến thể ↔ mã CJ · mặt tiền · tham khảo' },
    { key: 'danh_gia', label: 'Đánh giá', title: 'Review khách gửi — duyệt' },
    { key: 'cua_hang', label: 'Cửa hàng', title: 'Cấu hình cửa hàng + mặt tiền' },
  ] },
} as const satisfies Record<string, Trang>;

export type DuongCoTab = keyof typeof TAB_TRANG;
export const coTab = (duong: string): duong is DuongCoTab => Object.prototype.hasOwnProperty.call(TAB_TRANG, duong);

/** Link tới một tab: tab đầu (mặc định) = đường trần, URL sạch. */
export function hrefTab(duong: DuongCoTab, key: string): string {
  const t = TAB_TRANG[duong];
  return key === t.tabs[0]!.key ? duong : `${duong}?${t.param}=${encodeURIComponent(key)}`;
}

/** Items cho <Tabs>: nhãn/tiêu đề từ sổ, badge do trang tính. */
export function tabCua<T extends string>(duong: DuongCoTab, badge: Partial<Record<T, ReactNode>> = {}): { key: T; label: string; title?: string; badge?: ReactNode }[] {
  return TAB_TRANG[duong].tabs.map((t: TabTrang) => ({ key: t.key as T, label: t.label, title: t.title, badge: badge[t.key as T] }));
}
