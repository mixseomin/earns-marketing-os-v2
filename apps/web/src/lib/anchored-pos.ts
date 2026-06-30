// Dashboard popover positioning primitive (1 nguồn). Any popover/dropdown opened
// from an anchor element (assignee picker, site menu, status pill editor…) computes
// its fixed {top,left} via this so it never clips off the viewport edge: clamps to
// the right/left edges and flips ABOVE the anchor when it would overflow the bottom.
// Popover mới KHÔNG tự tính left/top — gọi cái này.
//
// rect   = anchor.getBoundingClientRect()
// width  = popover width (px)
// height = popover height estimate (px) — used only for the bottom-flip decision
export function anchoredPos(rect: { left: number; right: number; top: number; bottom: number }, width: number, height: number, gap = 4): { top: number; left: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const M = 8; // viewport margin

  let left = rect.left;
  if (left + width > vw - M) left = vw - width - M; // don't overflow right
  if (left < M) left = M;                           // …nor left

  let top = rect.bottom + gap;
  if (top + height > vh - M) {
    const above = rect.top - gap - height;
    top = above >= M ? above : Math.max(M, vh - height - M); // flip up, else clamp
  }
  return { top, left };
}
