// HÒM GÓP Ý CHO KHÁCH (anh 21/11/2026, dantranh.on.tc: "Nút này chỉ hiện ở vn thôi và ko cần đăng nhập").
// Trang công khai không có tài khoản mos2 (dantranh cấm kiểu đăng nhập) → người vào TỪ VIỆT NAM góp ý được không cần đăng nhập; ngoài VN nút ẩn.
// Một luật, ba chỗ đọc: nút /api/gop-y-ngoai/nut (ẩn nút ngoài VN) · middleware (cấp danh tính khách cho /nhung/gop-y) · actions gop-y-mos2 (người gửi = khách).
// Danh tính khách = cookie ngẫu nhiên host mos2.on.tc (iframe cùng site *.on.tc nên trình duyệt giữ) → "Của tôi" thấy đúng card mình gửi, trả lời / làm lại được.
// Middleware XOÁ header khách trình duyệt tự gửi rồi mới đặt lại → không giả được. Nước lấy từ CF-IPCountry (mos2 chỉ nhận lối Cloudflare).
// Thêm trang công khai = thêm một host vào TRANG_KHACH. Tự kiểm: gop-y-khach.test.mts. File này không 'use server' và không import node: (middleware chạy edge).

/** Trang công khai được góp ý không cần đăng nhập (người vào từ VN). */
export const TRANG_KHACH = ['dantranh.on.tc', 'dantranh2.on.tc'];
/** Nước được thấy nút / góp ý trên trang công khai. */
export const NUOC_KHACH = ['VN'];
export const COOKIE_KHACH = 'mos2-gop-y-khach';
export const HEADER_KHACH = 'x-mos2-gop-y-khach';

export const laTrangKhach = (host: string | null | undefined) => TRANG_KHACH.includes(String(host ?? '').split(':')[0]!.toLowerCase());
export const nuocDuocKhach = (nuoc: string | null | undefined) => NUOC_KHACH.includes(String(nuoc ?? '').toUpperCase());

/** Host của ?trang= trong URL khung nhúng /nhung/gop-y (rỗng nếu không phải). */
export function hostTrangNhung(url: string): string {
  try { const u = new URL(url); if (!u.pathname.startsWith('/nhung/gop-y')) return ''; return new URL(u.searchParams.get('trang') || '').hostname.toLowerCase(); } catch { return ''; }
}

const MA_KHACH = /^[a-f0-9-]{36}$/;
export const maKhachHopLe = (x: string | null | undefined) => MA_KHACH.test(String(x ?? ''));

/** Người gửi kiểu @mos2/gop-y (Nguoi) cho khách — email = mã khách (cột lọc "Của tôi"), tên hiện trong luồng = "Khách <trang>". */
export function nguoiKhach(ma: string | null | undefined, host: string): { email: string; displayName: string; role: string } | null {
  if (!maKhachHopLe(ma) || !laTrangKhach(host)) return null;
  return { email: `khach:${ma}`, displayName: `Khách ${host.split('.')[0]} · ${String(ma).slice(0, 4)}`, role: 'khach' };
}
