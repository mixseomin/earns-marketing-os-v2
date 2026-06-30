// Map habitat.kind → list of valid platform keys for that kind.
// Used by community-briefs UI to filter accounts to only those on a
// matching platform (e.g. r/astrology subreddit → only Reddit accounts).
//
// Return `null` for "kind is platform-agnostic" (forum, hashtag, other) —
// caller should fall back to habitat.platformKey if set, otherwise no
// platform filter.

const MAP: Record<string, string[] | null> = {
  subreddit:  ['reddit'],
  reddit:     ['reddit'],
  'fb-group': ['facebook'],
  fb_group:   ['facebook'],
  facebook:   ['facebook'],
  discord:    ['discord'],
  twitter:    ['twitter'],
  x:          ['twitter'],
  youtube:    ['youtube'],
  slack:      ['slack'],
  telegram:   ['telegram'],
  linkedin:   ['linkedin'],
  // platform-agnostic kinds — accept any account
  forum:      null,
  hashtag:    null,
  other:      null,
};

export function platformKeysForHabitatKind(kind: string): string[] | null {
  if (kind in MAP) return MAP[kind] ?? null;
  return null;
}

// Reverse map: platform_key → kind preset mặc định. Khi user chọn platform
// trong HabitatFormModal mà kind hiện tại không khớp → auto-set kind = preset.
const PLATFORM_TO_KIND: Record<string, string> = {
  reddit:   'subreddit',
  facebook: 'fb-group',
  discord:  'discord',
  twitter:  'hashtag',
  telegram: 'telegram',
  slack:    'slack',
  linkedin: 'linkedin',
  youtube:  'youtube',
};

export function defaultKindForPlatformKey(platformKey?: string | null): string | null {
  if (!platformKey) return null;
  return PLATFORM_TO_KIND[platformKey] ?? null;
}

// Kind có HỢP LỆ với platform không? True = match hoặc platform-agnostic.
// False = chắc chắn sai (vd platform=discord nhưng kind=subreddit).
export function isKindPlatformCompatible(kind: string, platformKey?: string | null): boolean {
  if (!platformKey) return true;
  const validKeys = MAP[kind];
  if (validKeys === undefined) return true; // unknown kind → cho qua
  if (validKeys === null) return true;       // platform-agnostic kind
  return validKeys.includes(platformKey);
}

// Best platform-key candidate for a habitat: explicit platformKey on the
// row wins over kind→map fallback. Returns single key (not array) since
// callers need the lock-target.
export function resolveHabitatPlatformKey(habitat: { kind: string; platformKey?: string | null }): string | null {
  if (habitat.platformKey) return habitat.platformKey;
  const fromKind = platformKeysForHabitatKind(habitat.kind);
  return fromKind?.[0] ?? null;
}

// Domain → platform_key heuristics. Used by HabitatFormModal to suggest a
// platform when admin pastes a URL (e.g. https://reddit.com/r/x → reddit,
// https://discord.gg/abc → discord). Returns null if no high-confidence match.
const HOSTNAME_TO_PLATFORM: Array<[RegExp, string]> = [
  [/(^|\.)reddit\.com$/i, 'reddit'],
  [/(^|\.)facebook\.com$/i, 'facebook'],
  [/(^|\.)fb\.com$/i, 'facebook'],
  [/(^|\.)discord\.(gg|com)$/i, 'discord'],
  [/(^|\.)twitter\.com$/i, 'twitter'],
  [/(^|\.)x\.com$/i, 'twitter'],
  [/(^|\.)t\.me$/i, 'telegram'],
  [/(^|\.)telegram\.org$/i, 'telegram'],
  [/(^|\.)slack\.com$/i, 'slack'],
  [/(^|\.)linkedin\.com$/i, 'linkedin'],
  [/(^|\.)youtube\.com$/i, 'youtube'],
  [/(^|\.)youtu\.be$/i, 'youtube'],
  [/(^|\.)medium\.com$/i, 'medium'],
  [/(^|\.)hackernews\.com$/i, 'hackernews'],
  [/(^|\.)news\.ycombinator\.com$/i, 'hackernews'],
  [/(^|\.)producthunt\.com$/i, 'producthunt'],
  [/(^|\.)indiehackers\.com$/i, 'indiehackers'],
  [/(^|\.)devto\.io$/i, 'devto'],
  [/(^|\.)dev\.to$/i, 'devto'],
  [/(^|\.)quora\.com$/i, 'quora'],
  [/(^|\.)bsky\.app$/i, 'bluesky'],
  [/(^|\.)bsky\.social$/i, 'bluesky'],
  [/(^|\.)threads\.net$/i, 'threads'],
  // backlink-source platforms (keys MUST match the platforms catalog — see seed-data/platforms.ts).
  [/(^|\.)alternativeto\.net$/i, 'alternativeto'],
  [/(^|\.)crunchbase\.com$/i, 'crunchbase'],
  [/(^|\.)substack\.com$/i, 'substack'],
  [/(^|\.)pinterest\.com$/i, 'pinterest'],
  [/(^|\.)hackernoon\.com$/i, 'hackernoon'],
  [/(^|\.)flipboard\.com$/i, 'flipboard'],
  [/(^|\.)saashub\.com$/i, 'saashub'],
  [/(^|\.)webcatalog\.io$/i, 'webcatalog'],
  [/(^|\.)softpedia\.com$/i, 'softpedia'],
  [/(^|\.)wordpress\.org$/i, 'wordpress-org'],
  [/(^|\.)slant\.co$/i, 'slant'],
  [/(^|\.)govloop\.com$/i, 'govloop'],
  [/(^|\.)rallypoint\.com$/i, 'rallypoint'],
  [/(^|\.)fedweek\.com$/i, 'fedweek'],
  [/(^|\.)pebforum\.com$/i, 'pebforum'],
  [/(^|\.)expat\.com$/i, 'expat-com'],
  [/(^|\.)visajourney\.com$/i, 'visajourney'],
  [/(^|\.)immigration\.com$/i, 'immigration-forums'],
  [/(^|\.)stackexchange\.com$/i, 'stackexchange'],
  [/(^|\.)featured\.com$/i, 'featured'],
  [/(^|\.)sourceofsources\.com$/i, 'sourceofsources'],
  [/(^|\.)mentionmatch\.com$/i, 'mentionmatch'],
  [/(^|\.)sourcebottle\.com$/i, 'sourcebottle'],
  // no-account sources (resolve for a clean label; classifier marks need_type='no-account')
  [/(^|\.)kk\.org$/i, 'kk-cooltools'],
  [/(^|\.)recomendo\.com$/i, 'recomendo'],
  [/(^|\.)wikipedia\.org$/i, 'wikipedia'],
  [/(^|\.)calculator\.net$/i, 'calculator-net'],
  [/(^|\.)llmstxt\.cloud$/i, 'llmstxt-cloud'],
  [/(^|\.)themilitarywallet\.com$/i, 'militarywallet'],
];

export function detectPlatformKeyFromUrl(url: string): string | null {
  if (!url || !url.trim()) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    for (const [re, key] of HOSTNAME_TO_PLATFORM) {
      if (re.test(host)) return key;
    }
  } catch { /* invalid URL */ }
  return null;
}

// Alias → canonical platform_key. Ext gửi key của NÓ (x, bsky) — catalog dùng
// canonical (twitter, bluesky). 1 nguồn sự thật cho mọi write-route (trước nằm
// inline ở register-own-post). Mirror core/platform.js CANON bên ext. Key lạ →
// trả nguyên (lowercased) để platform mới ko cần đăng ký trước.
const PLATFORM_ALIAS: Record<string, string> = {
  x: 'twitter',
  twitter: 'twitter',
  bsky: 'bluesky',
  bluesky: 'bluesky',
  // dev.to: label slugify ra 'dev-to'/'dev.to' nhưng ext + selector_overrides dùng 'devto'
  // → account ghi 'dev-to' ko khớp khi resolve. Gom mọi biến thể về 'devto'.
  'dev-to': 'devto',
  'dev.to': 'devto',
  devto: 'devto',
};
export function canonPlatformKey(raw?: string | null): string {
  const k = String(raw ?? '').trim().toLowerCase();
  return PLATFORM_ALIAS[k] ?? k;
}
