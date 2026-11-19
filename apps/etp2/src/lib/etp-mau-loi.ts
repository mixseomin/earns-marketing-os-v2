// LỜI THƯỜNG cho chữ máy dựng theo mẫu ghi vào sổ (etp.mau_dung.ghi / mau_dung_nk.ghi) — YDNI 9a: chữ trên trang không mang mã nội bộ, tên tệp, tên lớp lỗi.
// Dùng ở chân thẻ + ngăn chi tiết mẫu + ngăn dòng thời gian (tab Mẫu Creative etp2). Giữ nguyên ý, chỉ đổi cách nói.
const DOI: [RegExp, string][] = [
  [/^[A-Za-z_.]*(Error|Exception):\s*/, ''],
  [/chờ máy dựng theo mẫu \(iMac\) nhận/, 'chờ máy dựng nhận việc — hàng chờ chưa có lịch tự chạy, chỉ chạy khi được gọi'],
  [/\btap0*(\d+)#(\d+)\b/g, 'tập $1, khung $2'],
  [/\(tv(\d+)\)/g, '(mục thư viện $1)'],
  [/\b(dung-mau|dung_mau)(\.py)?\b/g, 'máy dựng theo mẫu'],
  [/\blen-creative(\.py)?\b/g, 'cổng tải creative'],
  [/ — xem nhật ký$/, ''],
];
export function loiThuongMau(s: string | null | undefined): string {
  let r = (s ?? '').trim();
  for (const [a, b] of DOI) r = r.replace(a, b);
  return r;
}
