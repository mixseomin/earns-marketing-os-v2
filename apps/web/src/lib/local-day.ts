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
