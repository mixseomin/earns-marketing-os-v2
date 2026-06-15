// ════════════════════════════════════════════════════════════════════════
// platform-url-parsers — 1 chỗ DUY NHẤT gom mọi logic "đọc URL của 1 platform".
//
// Trước đây Reddit-URL regex nằm rải rác trong các seeding route (insights-by-
// thing-id, bulk-insights, update-lifecycle-by-thing-id). Thêm platform mới =
// phải sửa từng route. Giờ: 1 registry per platform_key → route chỉ gọi
// helper, thêm platform = thêm 1 spec ở đây (KHÔNG sửa route).
//
// platform_key dùng CANONICAL (twitter, reddit, bluesky…) — gọi canonPlatformKey
// trước khi tra. Spec thiếu → fallback GENERIC (an toàn, không vỡ).
// ════════════════════════════════════════════════════════════════════════
import { canonPlatformKey, detectPlatformKeyFromUrl } from './habitat-platform-map';

export interface ParsedPostUrl {
  platformKey: string;
  /** Tên habitat để match (Reddit: 'r/Astrology_Vedic'; rỗng nếu platform ko có container công khai). */
  containerName: string;
  /** Token container thô (subreddit ko prefix). */
  containerSlug: string;
  /** ID thread/post gốc. */
  postId: string;
  /** Slug tiêu đề (nếu URL có). */
  slug: string;
  /** ID lá (Reddit: comment id; X: tweet id). = ID dùng để match thingId. */
  leafId: string;
  /** Permalink canonical của THREAD để lưu parent_url. */
  threadUrl: string;
  /** Prefix tên tác giả theo platform: 'u/' (reddit) · '@' (x). */
  authorPrefix: string;
}

interface PlatformUrlSpec {
  /** Prefix thingId cần strip (Reddit t1_/t3_). */
  idStrip: RegExp;
  /** thingId hợp lệ. */
  idValid: RegExp;
  /** ILIKE pattern trên cards.post_url để tìm card theo thingId. */
  searchPattern: (id: string) => string;
  /** Lấy thread id từ 1 URL bất kỳ (cho lifecycle fallback). null = ko hỗ trợ. */
  threadIdFrom: (url: string) => string | null;
  /** ILIKE pattern trên cards.parent_url để match thread (lifecycle fallback). */
  threadPattern: (threadId: string) => string;
  /** Parse đầy đủ 1 post/comment URL (auto-create card). undefined = ko hỗ trợ. */
  parsePostUrl?: (url: string) => ParsedPostUrl | null;
  /** URL trang nội quy đăng bài (Reddit /about/rules). '' nếu ko có. */
  postingRulesUrl: (baseUrl: string) => string;
}

// ── reddit ────────────────────────────────────────────────────────────────
// Comment URL: /r/Astrology_Vedic/comments/1to8wdg/astrology_reading/oo53o90/
const REDDIT_COMMENT_RE = /^\/r\/([^/]+)\/comments\/([^/]+)\/([^/]*)\/([a-z0-9]+)\/?$/i;
const reddit: PlatformUrlSpec = {
  idStrip: /^t[13]_/i,
  idValid: /^[a-z0-9]{4,12}$/i,
  searchPattern: (id) => `%/${id}/%`,
  threadIdFrom: (url) => url.match(/\/comments\/([a-z0-9]+)/i)?.[1] ?? null,
  threadPattern: (threadId) => `%/comments/${threadId}%`,
  parsePostUrl: (url) => {
    try {
      const u = new URL(url);
      if (!u.host.includes('reddit.com')) return null;
      const m = u.pathname.match(REDDIT_COMMENT_RE);
      if (!m) return null;
      const sub = m[1]!;
      const postId = m[2]!;
      const slug = m[3] ?? '';
      const leafId = m[4]!;
      return {
        platformKey: 'reddit',
        containerName: `r/${sub}`,
        containerSlug: sub,
        postId, slug, leafId,
        threadUrl: `https://www.reddit.com/r/${sub}/comments/${postId}/${slug}/`,
        authorPrefix: 'u/',
      };
    } catch { return null; }
  },
  postingRulesUrl: (baseUrl) => `${baseUrl.replace(/\/$/, '')}/about/rules`,
};

// ── twitter / x ─────────────────────────────────────────────────────────────
// Status URL: /<handle>/status/1234567890123456789  (tweet id = snowflake numeric)
const X_STATUS_RE = /^\/([^/]+)\/status\/(\d{5,25})/i;
const twitter: PlatformUrlSpec = {
  idStrip: /^$/,                              // X tweet id ko có prefix
  idValid: /^\d{5,25}$/,
  searchPattern: (id) => `%/status/${id}%`,
  threadIdFrom: (url) => url.match(/\/status\/(\d{5,25})/)?.[1] ?? null,
  threadPattern: (threadId) => `%/status/${threadId}%`,
  parsePostUrl: (url) => {
    try {
      const u = new URL(url);
      const m = u.pathname.match(X_STATUS_RE);
      if (!m) return null;
      const handle = m[1]!;
      const id = m[2]!;
      return {
        platformKey: 'twitter',
        containerName: '',                     // X reply ko gắn community container
        containerSlug: '',
        postId: id, slug: '', leafId: id,
        threadUrl: `https://x.com/${handle}/status/${id}`,
        authorPrefix: '@',
      };
    } catch { return null; }
  },
  postingRulesUrl: () => '',
};

// ── generic fallback ────────────────────────────────────────────────────────
// Platform chưa đăng ký: ID alphanum thoáng, search theo /id/ (an toàn, ko vỡ).
const generic: PlatformUrlSpec = {
  idStrip: /^$/,
  idValid: /^[a-z0-9_-]{3,40}$/i,
  searchPattern: (id) => `%/${id}/%`,
  threadIdFrom: () => null,
  threadPattern: (threadId) => `%/${threadId}/%`,
  postingRulesUrl: () => '',
};

const SPECS: Record<string, PlatformUrlSpec> = { reddit, twitter, generic };

/** Lấy spec theo platform_key (canon hoá trước). Thiếu → generic. */
export function getUrlSpec(platformKey?: string | null): PlatformUrlSpec {
  return SPECS[canonPlatformKey(platformKey)] ?? generic;
}

/** Strip prefix + lowercase-giữ-nguyên. KHÔNG validate (validate riêng). */
export function normalizeThingId(platformKey: string | null | undefined, raw: string): string {
  const spec = getUrlSpec(platformKey);
  return String(raw ?? '').trim().replace(spec.idStrip, '');
}

export function isValidThingId(platformKey: string | null | undefined, id: string): boolean {
  return getUrlSpec(platformKey).idValid.test(id);
}

/** ILIKE pattern tìm card theo thingId trên cards.post_url. */
export function postUrlSearchPattern(platformKey: string | null | undefined, id: string): string {
  return getUrlSpec(platformKey).searchPattern(id);
}

/** Parse 1 post/comment URL đầy đủ. Tự suy platform từ host nếu ko truyền. */
export function parsePostUrl(url: string, platformKey?: string | null): ParsedPostUrl | null {
  const pk = canonPlatformKey(platformKey) || detectPlatformKeyFromUrl(url) || '';
  const spec = getUrlSpec(pk);
  return spec.parsePostUrl ? spec.parsePostUrl(url) : null;
}

/** Thread fallback (lifecycle): { threadId, pattern } từ 1 URL, hoặc null. */
export function threadFallback(
  platformKey: string | null | undefined,
  url: string,
): { threadId: string; pattern: string } | null {
  const spec = getUrlSpec(platformKey);
  const threadId = spec.threadIdFrom(url);
  if (!threadId) return null;
  return { threadId, pattern: spec.threadPattern(threadId) };
}

export function postingRulesUrl(platformKey: string | null | undefined, baseUrl: string): string {
  if (!baseUrl) return '';
  return getUrlSpec(platformKey).postingRulesUrl(baseUrl);
}
