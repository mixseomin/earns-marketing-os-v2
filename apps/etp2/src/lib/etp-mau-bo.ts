// MÀU BỘ TÀI KHOẢN — MỘT bảng cho cả etp2: huy hiệu bộ (etp-view), viền tháp bộ trên thành phố, nút chọn bộ ở Thao tác bảng phim
// (anh 15/11/2026 "Bộ tk nhìn chưa phân biệt được. Có thể dùng màu viền chứ"). Khoá lạ (tài khoản QC người trong team) lấy màu theo thứ tự tháp.
export const MAU_BO: Record<string, string> = { '1': '#3b82f6', '2': '#a855f7', '3': '#f59e0b', '4': '#10b981', '5': '#ef4444' };
const DU = ['#3b82f6', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899'];
export const mauBo = (bo: string, thuTu = 0) => MAU_BO[bo] ?? DU[thuTu % DU.length]!;
