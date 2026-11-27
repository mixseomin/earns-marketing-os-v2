// NGUỒN PHIM MÁY DỰNG BÀI LẤY ĐƯỢC TẬP (khang 27/11/2026, sau lượt mia-calloway 29/11 hỏng cả ngày).
// Máy dựng dạng Reel cắt cảnh tải tập miễn phí bằng scripts/ethopex/tai-tap.py — tệp đó CHỈ đọc được 3 site gốc dưới đây.
// Đề nạp một phim ở nguồn khác (flickreels.net: phim 219774 "Called a Jinx…", tập 1 khoá) vẫn vào kho bình thường,
// tới lượt dựng mới chết "tai-tap.py không lấy được tập nào của phim 219774" → ngày đó thiếu bài mà không ai biết trước.
// Chặn ngay ở cổng nạp đề (napVideo) để đề sai không bao giờ vào kho. Thuần, không chạm cơ sở dữ liệu.

/** Site gốc tai-tap.py đọc được (tên miền + mọi tên miền con). */
export const HOST_PHIM = ['reelshort.com', 'netshort.com', 'dramaboxdb.com'];

/** Lỗi của một đề mang phim, hoặc null nếu dựng được. `url` = etp.thu_vien_phim.url của content_id đó ('' nếu chưa có). */
export function loiPhim(phim: unknown, url: unknown): string | null {
  if (phim == null || phim === '') return null;   // bài không dùng phim (ảnh đời thường…) — không kiểm
  const id = String(phim);
  if (!url) return `phim ${id} chưa có link trong etp.thu_vien_phim — máy không tải được tập nào`;
  let host = '';
  try { host = new URL(String(url)).hostname.toLowerCase(); } catch { /* link rác */ }
  if (!HOST_PHIM.some((x) => host === x || host.endsWith(`.${x}`))) {
    return `phim ${id}: nguồn ${host || String(url).slice(0, 60)} chưa tải được tập (chỉ ReelShort / NetShort / DramaBox) — chọn phim khác`;
  }
  return null;
}
