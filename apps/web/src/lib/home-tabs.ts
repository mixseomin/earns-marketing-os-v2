// Hằng của tab trang chủ — file THƯỜNG (không 'use client'): server page import được giá trị thật.
// Import hằng từ module 'use client' vào server component thì nhận client-reference thay vì chuỗi
// (cookie đọc bằng tên sai → thứ tự không bao giờ áp, tab mặc định là object → không tab nào vẽ). Đã dính 16/09/2026.
export type HomeTab = 'camp' | 'phu' | 'nguon' | 'hatang' | 'luat' | 'lenh' | 'doanhthu' | 'seo' | 'email' | 'duan';
export const HOME_TABS: HomeTab[] = ['camp', 'phu', 'nguon', 'hatang', 'luat', 'lenh', 'doanhthu', 'seo', 'email', 'duan'];
export const HOME_TAB_MAC_DINH: HomeTab = 'camp';
export const HOME_TABS_COOKIE = 'home-tabs';
