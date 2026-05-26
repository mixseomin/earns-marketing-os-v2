// Validate CSS selector trước khi save vào selector_overrides.
// Reject patterns không stable / không generic cho mọi instance platform.

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  // Reddit-specific sub IDs: t5_xxxxx (1 sub only)
  { regex: /\bt5_[a-z0-9]+/i, reason: 'Sub ID t5_xxx (Reddit-specific, chỉ work 1 subreddit)' },
  // Subreddit names trong href/src
  { regex: /\[(?:href|src)[*^$~|]?=['"][^'"]*\/r\//i, reason: 'Subreddit name hardcoded trong href/src' },
  // styles.redditmedia.com/t5_xxx/ paths
  { regex: /styles\.redditmedia\.com\/t5_/i, reason: 'Reddit CDN path chứa sub ID' },
  // nth-of-type, nth-child (re-render fragile)
  { regex: /:nth-(?:of-type|child)\b/i, reason: 'nth-of-type / nth-child fragile khi DOM re-order' },
  // :has() PASS: Chrome 105+ support OK. MOS2 Crew ext chạy Chrome,
  // dashboard server-side scraping (puppeteer/playwright) cũng Chromium.
  // Không cần Safari compat. Rule cũ removed 2026-05-26.
  // Class hash random Reddit-style (.css-1abc23d)
  { regex: /\.css-[a-z0-9]{5,}/i, reason: 'Class hash random (CSS-in-JS hash, đổi mọi build)' },
  // Deep > direct-child chains (>6 levels — fragile khi DOM re-nest)
  // Modern apps thường 4-5 levels (Reddit aside > div > div.md > p > a),
  // nên raise threshold lên 6+ direct-child operators.
  { regex: />[^>]+>[^>]+>[^>]+>[^>]+>[^>]+>[^>]+>/i, reason: 'Direct-child chain >6 levels deep (fragile)' },
  // Class BEM (__elem) thiếu dấu chấm trước — không phải custom tag.
  // Match standalone "something__something" mà KHÔNG có "." hoặc "-" custom-element-like ngay trước.
  // Cụ thể: matches "shreddit-subreddit-icon__icon" nếu KHÔNG có "." trước.
  // Regex: word-char + __ + word-char, KHÔNG có "." ngay trước.
  // Custom elements có "-" trong tên tag (vd <shreddit-subreddit-icon>), nhưng KHÔNG có "__".
  // Vậy "__" trong selector = chắc chắn BEM class, phải có dấu "." trước.
  { regex: /(?:^|[\s>~+(])[a-zA-Z][\w-]*__\w/, reason: 'BEM class (__elem) thiếu dấu chấm trước - phải là .class' },
];

export function validateSelector(css: string): ValidationResult {
  if (!css || typeof css !== 'string') return { ok: false, error: 'css empty' };
  const trimmed = css.trim();
  if (trimmed.length < 2) return { ok: false, error: 'css quá ngắn' };
  if (trimmed.length > 500) return { ok: false, error: 'css quá dài (>500 chars)' };

  for (const { regex, reason } of FORBIDDEN_PATTERNS) {
    if (regex.test(trimmed)) {
      return { ok: false, error: `Selector vi phạm rule: ${reason}` };
    }
  }
  return { ok: true };
}
