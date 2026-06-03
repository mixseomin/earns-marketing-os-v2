// normalizeParentUrl — key ổn định cho 1 thread/comment để match engagement + drafts
// history. URL trình duyệt có query đổi MỖI LẦN xem (vd Reddit `?context=1&
// screen_view_count=N`) → exact-match `parent_url` ko bao giờ trúng khi mở lại →
// ext "như mới". Strip query (?...) + fragment (#...) + trailing slash. Dùng cả khi
// LƯU (card.parent_url) và khi ĐỌC (engagements/list-drafts). Read còn strip cột stored
// trong SQL (rtrim(split_part(parent_url,'?',1),'/')) để khớp card cũ lưu raw.
export function normalizeParentUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  let u = String(url).trim();
  if (!u) return null;
  const hash = u.indexOf('#'); if (hash >= 0) u = u.slice(0, hash);
  const q = u.indexOf('?'); if (q >= 0) u = u.slice(0, q);
  u = u.replace(/\/+$/, '');
  return u || null;
}
