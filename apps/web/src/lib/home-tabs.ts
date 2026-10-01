// Hằng của tab trang chủ — file THƯỜNG (không 'use client'): server page import được giá trị thật.
// Import hằng từ module 'use client' vào server component thì nhận client-reference thay vì chuỗi
// (cookie đọc bằng tên sai → thứ tự không bao giờ áp, tab mặc định là object → không tab nào vẽ). Đã dính 16/09/2026.
// Danh sách tab + nhãn nằm ở sổ chung lib/tab-trang.ts (trang + menu cùng đọc) — ở đây chỉ suy ra.
import { TAB_TRANG } from './tab-trang';
export type HomeTab = (typeof TAB_TRANG)['/']['tabs'][number]['key'];
export const HOME_TABS: HomeTab[] = TAB_TRANG['/'].tabs.map((t) => t.key);
export const HOME_TAB_MAC_DINH: HomeTab = 'camp';
export const HOME_TABS_COOKIE = 'home-tabs';
