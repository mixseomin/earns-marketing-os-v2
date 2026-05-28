// Habitat kind → display label + glyph. Centralize 1 chỗ; trước đây define
// inline trong tribes-page.tsx → các nơi khác (ai-habitat-tribes-modal,
// habitat-form-modal, ...) duplicate hoặc lookup raw kind string.

export const HABITAT_KIND_LABEL: Record<string, string> = {
  'fb-group':   'FB Group',
  'fb-page':    'FB Page',
  'subreddit':  'Subreddit',
  'forum':      'Forum',
  'cafe':       'Cafe',
  'group':      'Group',
  'feed':       'Feed',
  'org':        'Org',
  'hashtag':    'Hashtag',
  'tiktok-tag': 'TikTok #',
  'ig-tag':     'IG #',
  'youtube':    'YouTube',
  'twitter':    'X/Twitter',
  'discord':    'Discord',
  'slack':      'Slack',
  'telegram':   'Telegram',
  'zalo':       'Zalo',
  'offline':    'Offline',
  'other':      'Other',
};

export const HABITAT_KIND_GLYPH: Record<string, string> = {
  'fb-group':   '[G]',
  'fb-page':    '[P]',
  'subreddit':  '[r/]',
  'forum':      '[F]',
  'cafe':       '[C]',
  'group':      '[g]',
  'feed':       '[~]',
  'org':        '[O]',
  'hashtag':    '[#]',
  'tiktok-tag': '[#t]',
  'ig-tag':     '[#i]',
  'youtube':    '[Y]',
  'twitter':    '[X]',
  'discord':    '[D]',
  'slack':      '[S]',
  'telegram':   '[T]',
  'zalo':       '[Z]',
  'offline':    '[•]',
  'other':      '[?]',
};

export function getHabitatKindLabel(kind: string | null | undefined): string {
  return HABITAT_KIND_LABEL[kind ?? ''] ?? (kind ?? '?');
}
export function getHabitatKindGlyph(kind: string | null | undefined): string {
  return HABITAT_KIND_GLYPH[kind ?? ''] ?? '[?]';
}
