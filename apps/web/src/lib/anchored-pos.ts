// Dashboard popover positioning primitive (1 nguồn). Any popover/dropdown opened
// from an anchor element (assignee picker, site menu, status pill editor…) computes
// its fixed {top,left} via this so it never clips off the viewport edge: clamps to
// the right/left edges and flips ABOVE the anchor when it would overflow the bottom.
// Popover mới KHÔNG tự tính left/top — gọi cái này.
//
// rect   = anchor.getBoundingClientRect()
// width  = popover width (px)
// height = popover height estimate (px) — used only for the bottom-flip decision
// maxHeight = chỗ thật còn lại ở phía đặt popover (popover đặt overflowY auto + maxHeight này thì không bao giờ tràn màn).
// KHÔNG BAO GIỜ ĐÈ LÊN ANCHOR (02/11/2026: menu ⋯ có lịch nhỏ cao 560px trên màn thấp bị kẹp đè lên chính nút ⋯ — bấm nút lại trúng ô lịch,
// anh báo "không bấm được dropmenu"): dưới không đủ thì lật lên; cả hai phía đều không đủ thì chọn phía rộng hơn và trả maxHeight để popover tự cuộn.
export function anchoredPos(rect: { left: number; right: number; top: number; bottom: number }, width: number, height: number, gap = 4): { top: number; left: number; maxHeight: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const M = 8; // viewport margin

  let left = rect.left;
  if (left + width > vw - M) left = vw - width - M; // don't overflow right
  if (left < M) left = M;                           // …nor left

  const duoi = vh - M - (rect.bottom + gap), tren = rect.top - gap - M;
  if (height <= duoi) return { top: rect.bottom + gap, left, maxHeight: duoi };
  if (height <= tren) return { top: rect.top - gap - height, left, maxHeight: tren };
  return duoi >= tren ? { top: rect.bottom + gap, left, maxHeight: duoi } : { top: M, left, maxHeight: tren };
}
