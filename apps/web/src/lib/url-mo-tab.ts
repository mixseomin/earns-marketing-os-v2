// Bấm kèm ⌘/Ctrl (hoặc chuột giữa) lên một bộ lọc = MỞ TAB MỚI với URL đã áp bộ lọc đó, thay vì đổi tab đang xem
// (anh chốt 20/09/2026, áp cho mọi bộ lọc). Dùng chung cho Segmented / FilterChips / ViewToggle.
import type { MouseEvent } from 'react';

/** URL hiện tại với `key=value` (value rỗng/undefined → xoá key). Chỉ chạy ở client. */
export function urlVoiParam(key: string, value: string | null | undefined): string {
  const u = new URL(window.location.href);
  if (value) u.searchParams.set(key, value); else u.searchParams.delete(key);
  return u.href;
}

/** true nếu đã xử lý (mở tab mới) — caller return ngay, không đổi state. */
export function moTabNeuModifier(e: MouseEvent, href: string | null | undefined): boolean {
  if (!href || !(e.metaKey || e.ctrlKey || e.button === 1)) return false;
  e.preventDefault(); e.stopPropagation();
  window.open(href, '_blank', 'noopener');
  return true;
}
