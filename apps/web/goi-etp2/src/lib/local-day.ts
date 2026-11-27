/**
 * Ngày lịch theo giờ NGƯỜI XEM, từ một timestamp ISO (UTC) hoặc chuỗi ngày sẵn.
 *
 * `iso.slice(0, 10)` cắt ra ngày UTC. Với người vận hành ở GMT+7, mọi việc làm từ 17h trở đi
 * rơi xuống ô ngày HÔM TRƯỚC — lịch /plays từng hiện 9 card đóng lúc rạng sáng 07/08 ở ô 06/08.
 * Chuỗi 'YYYY-MM-DD' (vd site_scheduled_at) vốn không có múi giờ nên trả nguyên, đừng ép qua
 * `new Date()` — làm thế lại sinh lệch ngược lại.
 */
export function localDay(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return iso.slice(0, 10); }
}

/**
 * Hôm nay theo giờ NGƯỜI XEM, dạng 'YYYY-MM-DD'.
 *
 * `new Date().toISOString().slice(0,10)` cho hôm nay theo UTC. Với người vận hành ở GMT+7, từ
 * 00:00 đến 07:00 giờ Việt Nam thì UTC vẫn là NGÀY HÔM QUA — mọi phép so "đã tới hạn chưa" sai
 * suốt bảy tiếng mỗi ngày. Chỗ nào so với ngày người dùng nhập (site_scheduled_at, follow_up_at)
 * thì phải dùng hàm này. Chỗ nào thật sự cần UTC (báo cáo GSC/Bing) thì cứ dùng toISOString.
 */
export const todayLocal = (): string => localDay(new Date().toISOString());

/**
 * Múi giờ VẬN HÀNH. `todayLocal()` ở trên đọc múi giờ của tiến trình đang chạy — đúng trên trình
 * duyệt, nhưng SAI trên máy chủ (box3 chạy UTC). Server component cần "hôm nay" giống hệt cái trình
 * duyệt sẽ tính thì phải nói rõ múi giờ, không thể dựa vào môi trường.
 *
 * Dùng khi: server render một thứ phụ thuộc ngày (lịch). Không nói được ngày ở server thì component
 * buộc phải để trống chờ mount → người dùng thấy khoảng rỗng rồi nội dung nhảy vào (lịch /plays đã
 * dính đúng thế, 2026-08-08).
 */
export const APP_TZ = 'Asia/Ho_Chi_Minh';
/** 'YYYY-MM-DD' theo APP_TZ. 'en-CA' cho đúng thứ tự năm-tháng-ngày, không phải mẹo. */
export const todayInAppTz = (): string => new Date().toLocaleDateString('en-CA', { timeZone: APP_TZ });
