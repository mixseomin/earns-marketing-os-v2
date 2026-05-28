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
  [/(^|\.)threads\.net$/i, 'threads'],
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
