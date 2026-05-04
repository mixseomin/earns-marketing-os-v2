// Map platform key → URL pattern dẫn tới user profile public page.
// `{handle}` là placeholder thay bằng account.handle (đã strip leading @).
//
// Để override per-tenant hoặc thêm platform mới, sau này sẽ thêm column
// `profile_url_pattern` vào platforms table — helper này fallback nếu DB chưa có.
//
// Pattern không có ở đây = platform không có public profile (vd: Discord DM,
// Telegram bot) → trả null → UI không show link.
const PROFILE_URL_PATTERNS: Record<string, string> = {
  // Social
  twitter:        'https://twitter.com/{handle}',
  threads:        'https://www.threads.net/@{handle}',
  bluesky:        'https://bsky.app/profile/{handle}',
  mastodon:       'https://mastodon.social/@{handle}',
  facebook:       'https://www.facebook.com/{handle}',
  instagram:      'https://www.instagram.com/{handle}',
  linkedin:       'https://www.linkedin.com/in/{handle}',
  pinterest:      'https://www.pinterest.com/{handle}',
  tiktok:         'https://www.tiktok.com/@{handle}',
  youtube:        'https://www.youtube.com/@{handle}',
  twitch:         'https://www.twitch.tv/{handle}',
  vimeo:          'https://vimeo.com/{handle}',
  soundcloud:     'https://soundcloud.com/{handle}',

  // Forums / community
  reddit:         'https://www.reddit.com/user/{handle}',
  hackernews:     'https://news.ycombinator.com/user?id={handle}',
  lobsters:       'https://lobste.rs/u/{handle}',
  quora:          'https://www.quora.com/profile/{handle}',
  stackoverflow:  'https://stackoverflow.com/users/{handle}',
  indiehackers:   'https://www.indiehackers.com/{handle}',
  lemmy:          'https://lemmy.world/u/{handle}',
  voz:            'https://voz.vn/u/{handle}',
  tinhte:         'https://tinhte.vn/profile/{handle}',
  webtretho:      'https://www.webtretho.com/f/member/{handle}',

  // Dev / makers
  github:         'https://github.com/{handle}',
  devto:          'https://dev.to/{handle}',
  hashnode:       'https://hashnode.com/@{handle}',
  medium:         'https://medium.com/@{handle}',
  producthunt:    'https://www.producthunt.com/@{handle}',
  betalist:       'https://betalist.com/@{handle}',
  fazier:         'https://fazier.com/@{handle}',
  saashub:        'https://www.saashub.com/users/{handle}',
  alternativeto:  'https://alternativeto.net/user/{handle}',
  appsumo:        'https://appsumo.com/profile/{handle}',
  microlaunch:    'https://microlaunch.net/@{handle}',
  toolify:        'https://www.toolify.ai/@{handle}',

  // Design
  dribbble:       'https://dribbble.com/{handle}',
  behance:        'https://www.behance.net/{handle}',
  figma:          'https://www.figma.com/@{handle}',
  readcv:         'https://read.cv/{handle}',

  // Newsletter / blog
  substack:       'https://{handle}.substack.com',
  beehiiv:        'https://{handle}.beehiiv.com',
  ghost:          'https://{handle}.ghost.io',
  buttondown:     'https://buttondown.email/{handle}',
  mirror:         'https://mirror.xyz/{handle}',
  wordpress:      'https://{handle}.wordpress.com',
  // mailchimp / convertkit không có public profile

  // Marketplace / monetization
  gumroad:        'https://{handle}.gumroad.com',
  buymeacoffee:   'https://www.buymeacoffee.com/{handle}',
  etsy:           'https://www.etsy.com/shop/{handle}',
  // lemonsqueezy / paddle không có public seller profile public-friendly

  // Video / podcast
  spotifypodcasters: 'https://podcasters.spotify.com/pod/show/{handle}',
  odysee:         'https://odysee.com/@{handle}',

  // Decentralized
  nostr:          'https://primal.net/p/{handle}',

  // Messaging — phần lớn không có public profile, để trống
  // discord: account ID dạng số → khó link tới profile public
  // telegram: t.me/{handle} works for public usernames
  telegram:       'https://t.me/{handle}',
  // slack / whatsapp: không có public profile URL
};

// Trả về hardcoded suggestion cho 1 platform — admin xài cho UI gợi ý
// "💡 Suggested pattern" trong PlatformPicker / platforms-page edit form.
export function getSuggestedProfileUrlPattern(platformKey: string): string | null {
  return PROFILE_URL_PATTERNS[platformKey] ?? null;
}

// Resolve profile URL cho 1 account.
// Priority:
//   1. dbPattern (platform.profile_url_pattern, admin override) — nếu có
//   2. hardcoded PROFILE_URL_PATTERNS[platformKey] — fallback
//   3. null — platform chưa có pattern nào, UI không show link
export function profileUrlFor(
  platformKey: string,
  handle: string | null,
  dbPattern?: string | null,
): string | null {
  if (!handle) return null;
  const pattern = (dbPattern && dbPattern.trim()) || PROFILE_URL_PATTERNS[platformKey];
  if (!pattern) return null;
  const clean = handle.replace(/^@+/, '').trim();
  if (!clean) return null;
  return pattern.replace('{handle}', encodeURIComponent(clean));
}
