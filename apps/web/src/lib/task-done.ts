// "Xong" phải CHỈ RA ĐƯỢC kết quả — luật chung, một chỗ.
//
// Trước đây bấm Completed là card đóng, mở lại không thấy sản phẩm đâu: board báo 7/14 xong trong khi
// không card nào trỏ tới thứ nó làm ra. Status như thế nói dối, và mọi thứ đọc board (KPI, tiến độ sản
// phẩm, /now) đều sai theo. Nên điều kiện đóng card là BẰNG CHỨNG, không phải cú bấm:
//
//   backlink · seed → link đã đặt được (không có link thì việc chưa xảy ra, mô tả không thay được)
//   email · build   → link kết quả HOẶC một câu tả kết quả (blast không sinh URL; card viết sách thì
//                     artifact là file/bản dựng — bắt buộc URL sẽ đẻ ra URL bịa)
//
// Client (drawer) gọi để CHẶN TRƯỚC ở nút bấm; setBacklinkSite gọi lại ở server để CLI/ext không lách
// được. Pure — không import server runtime (xem lib/prefs.ts: module vừa client vừa server thì vỡ prerender).

import { type TaskKind } from './task-kind';

export const DONE_STATES = new Set(['completed', 'verified']);
export const MIN_RESULT_NOTE = 20;   // đủ cho một câu tả kết quả thật, không lọt "xong" / "ok" / "done"

const isUrl = (s?: string | null) => /^https?:\/\/\S+$/i.test((s || '').trim());

/** '' = được phép đóng. Chuỗi = lý do bị chặn (hiện luôn trên nút, không phải toast biến mất). */
export function doneBlockReason(t: { kind: TaskKind; url?: string | null; note?: string | null }, next: string): string {
  if (!DONE_STATES.has(next)) return '';
  if (isUrl(t.url)) return '';
  if (t.kind === 'backlink' || t.kind === 'seed') return 'Chưa có link kết quả — dán link đã đặt được rồi mới đóng được card.';
  if ((t.note || '').trim().length >= MIN_RESULT_NOTE) return '';
  return `Chưa có kết quả — dán link sản phẩm/bản dựng, hoặc tả kết quả (≥${MIN_RESULT_NOTE} ký tự) ở "📣 Phản hồi của bạn".`;
}

/** Card ĐANG ở trạng thái xong mà không có bằng chứng = dữ liệu cũ nói dối → surface để sửa, không tự lật. */
export function doneWithoutProof(t: { kind: TaskKind; state: string; url?: string | null; note?: string | null }): boolean {
  return DONE_STATES.has(t.state) && !!doneBlockReason(t, t.state);
}
