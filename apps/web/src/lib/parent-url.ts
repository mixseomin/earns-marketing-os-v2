// normalizeParentUrl — key ổn định cho 1 thread/comment để match engagement + drafts
// history. URL trình duyệt có query đổi MỖI LẦN xem (vd Reddit `?context=1&
// screen_view_count=N`) → exact-match `parent_url` ko bao giờ trúng khi mở lại →
// ext "như mới". Strip query (?...) + fragment (#...) + trailing slash. Dùng cả khi
// LƯU (card.parent_url) và khi ĐỌC (engagements/list-drafts). Read còn strip cột stored
// trong SQL (rtrim(split_part(parent_url,'?',1),'/')) để khớp card cũ lưu raw.
// Regex Reddit thread canonical — phải KHỚP với backfill SQL trong DB.
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
  u = u.replace(/\/+$/, '');
  return u || null;
}
