// normalizeParentUrl — canonical key cho 1 thread để match version/track/engagement.
// URL trình duyệt đổi mỗi lần xem (Reddit `?screen_view_count=N`, forum `/page-N`,
// permalink `/post-N`, slug) → exact-match parent_url ko trúng. Strip query/fragment/
// trailing-slash + canonical Reddit thread (`/r/<sub>/comments/<id>`) + forum suffix.
// NGUỒN SỰ THẬT DUY NHẤT: kết quả lưu vào cột cards.thread_key (set ở updatePost);
// MỌI read so BẰNG thread_key (ko còn regexp SQL phân kỳ). Migration 0088.
const REDDIT_THREAD_RE = /^https?:\/\/(?:[a-z0-9-]+\.)?reddit\.com\/r\/[^/]+\/comments\/[a-z0-9]+/i;

export function normalizeParentUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  let u = String(url).trim();
  if (!u) return null;
  const hash = u.indexOf('#'); if (hash >= 0) u = u.slice(0, hash);
  const q = u.indexOf('?'); if (q >= 0) u = u.slice(0, q);
  // Reddit: gom MỌI comment/slug của 1 thread về canonical thread key (vd
  // /comments/1tvkx54/<slug>/ và /comments/1tvkx54/comment/<cid>/ → cùng key).
  // → mở lại bất kỳ comment permalink nào của thread đã engage đều khớp history.
  const r = u.match(REDDIT_THREAD_RE);
  if (r) return r[0].toLowerCase();
  // Forum (XenForo…): 1 thread trải nhiều trang/permalink → canonical về thread,
  // bỏ hậu tố /page-N · /post-N · /unread · /latest · /reply (gen ở page-3, xem
  // page-4 vẫn khớp). Sự cố tracked không hiện 2026-06-05.
  u = u.replace(/\/(page-\d+|post-\d+|unread|latest|reply)\/?$/i, '');
  u = u.replace(/\/+$/, '');
  return u || null;
}
