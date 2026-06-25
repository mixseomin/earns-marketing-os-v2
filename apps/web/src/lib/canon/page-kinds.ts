// ── CANON: page_kind ─────────────────────────────────────────────────────────
// MỘT danh mục duy nhất cho mọi page_kind hợp lệ. "x-entity for page context."
// Trước đây page_kind bị set rải rác (guessPageKind regex, FIELD_SCHEMAS keys,
// METRIC_PAGE_KIND, VERBATIM_PAGE_KINDS, ext hardcode 'subreddit-about'…) →
// dễ lệch + leak tên namespaced (subreddit-about dán lên forum phpbb).
// Giờ: define Ở ĐÂY, mọi nơi khác tham chiếu. Thêm/đổi page_kind chỉ sửa file này.
//
// NAMING RULE: key phải PLATFORM-NEUTRAL. Tên riêng 1 nền tảng (subreddit-about =
// Reddit) chỉ được dùng khi page_kind đó THỰC SỰ chỉ tồn tại trên nền tảng ấy
// (mode='read', reddit-only). Khái niệm chung (board listing) = tên chung
// (thread-list), KHÔNG mượn tên Reddit.

export interface PageKindEntry {
  /** Canonical key — khớp selector_overrides.page_kind + FIELD_SCHEMAS key. */
  key: string;
  /** Nhãn UI ngắn. */
  label: string;
  /** read = parse field từ DOM · write = điền form (signup/composer). */
  mode: 'read' | 'write';
  /** Ý nghĩa — Claude/UI tra cứu thay vì đoán. */
  meaning: string;
  /** field_name dạng dotted/CSS-entity → canonField giữ nguyên hoa-thường (composer). */
  verbatimFields?: boolean;
  /** save-selector default attr='value' (form-fill) — CHỈ signup (composer có cả nút click). */
  fillAttr?: boolean;
  /** URL regex để guessPageKind() đoán nhãn lúc lưu DOM sample. Thứ tự = ưu tiên. */
  urlHint?: RegExp;
  /** Chỉ tồn tại trên 1 platform (tên namespaced hợp lệ). */
  platformOnly?: string;
}

// Thứ tự = ưu tiên match trong guessPageKind (first-match-wins).
export const PAGE_KINDS: PageKindEntry[] = [
  { key: 'subreddit-about', label: 'Subreddit about', mode: 'read', platformOnly: 'reddit',
    meaning: 'Trang giới thiệu cộng đồng Reddit (/r/<sub>/about): subscribers, rules, mod…',
    urlHint: /reddit\.com\/r\/[^/]+\/about|\/r\/[^/]+\/?$/ },
  // signup PHẢI đứng trước account-profile: /user/register chứa "/user/" sẽ khớp
  // account-profile nếu account-profile xét trước → register bị phân loại nhầm thành profile.
  { key: 'signup', label: 'Signup', mode: 'write', fillAttr: true,
    meaning: 'Form đăng ký tài khoản: username, email, password, ToS…',
    urlHint: /ucp\.php[^#]*mode=register|\/register|\/signup|\/sign-up|\/join\b/ },
  { key: 'account-profile', label: 'Account profile', mode: 'read',
    meaning: 'Trang hồ sơ 1 thành viên: bio, join date, post count, avatar.',
    urlHint: /memberlist\.php[^#]*mode=viewprofile|\/u\/|\/user\/|\/users\/|\/profile|\/member\.|\/members?\/\w/ },
  { key: 'composer', label: 'Composer', mode: 'write', verbatimFields: true,
    meaning: 'Form soạn bài/trả lời (post/reply). Field = selector-entity name (verbatim).',
    urlHint: /posting\.php[^#]*mode=(reply|post|quote)|\/submit|\/compose|\/new-post|\/post\/new/ },
  { key: 'post-metrics', label: 'Post metrics', mode: 'read',
    meaning: 'Trang xem 1 thread/topic — nơi đọc SỐ engagement (views/score/replies).',
    urlHint: /viewtopic\.php|\/thread|\/topic|\/t\/\d|comments\// },
  { key: 'member-list', label: 'Member list', mode: 'read',
    meaning: 'Danh bạ thành viên (memberlist) — list, không phải 1 hồ sơ.',
    urlHint: /memberlist\.php/ },
  { key: 'thread-list', label: 'Thread list', mode: 'read',
    meaning: 'Trang liệt kê thread của 1 board/forum (viewforum, board index).',
    urlHint: /viewforum\.php|\/forum|\/board|\/forums?\// },
  { key: 'platform-any', label: 'Platform (any)', mode: 'read',
    meaning: 'Scope toàn nền tảng, không gắn 1 trang cụ thể (viewer handle, profile global).' },
  { key: 'page', label: 'Page (unknown)', mode: 'read',
    meaning: 'Fallback khi không khớp pattern nào.' },
];

export const PAGE_KIND_BY_KEY: Record<string, PageKindEntry> =
  Object.fromEntries(PAGE_KINDS.map((p) => [p.key, p]));

export const PAGE_KIND_KEYS = new Set(PAGE_KINDS.map((p) => p.key));

/** page_kind có save-selector default attr='value' (form-fill) — chỉ signup. */
export const WRITE_PAGE_KINDS = new Set(PAGE_KINDS.filter((p) => p.fillAttr).map((p) => p.key));

/** page_kind giữ field_name verbatim (composer) — canonField đọc cờ này. */
export const VERBATIM_PAGE_KINDS = new Set(PAGE_KINDS.filter((p) => p.verbatimFields).map((p) => p.key));

/** Đoán page_kind từ URL khi lưu DOM sample. Chỉ là nhãn xếp thư viện. */
export function guessPageKind(url: string): string {
  const u = (url || '').toLowerCase();
  for (const p of PAGE_KINDS) { if (p.urlHint && p.urlHint.test(u)) return p.key; }
  return 'page';
}
