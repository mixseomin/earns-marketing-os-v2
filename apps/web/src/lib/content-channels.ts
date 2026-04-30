// Content channel + status catalogs. Plain constants — exported từ
// non-'use server' file để Next.js không wrap thành server action proxies
// (gây "s.filter is not a function" client-side).

export const CHANNELS: Array<{ id: string; label: string; icon: string; hint: string }> = [
  { id: 'fb-post',         label: 'FB post',        icon: '📘', hint: 'Facebook feed post — long-form, story-led' },
  { id: 'email',           label: 'Email',          icon: '✉️', hint: 'Newsletter / sequence email' },
  { id: 'ad',              label: 'Ad',             icon: '📊', hint: 'Paid ad copy — short headline + CTA' },
  { id: 'reel',            label: 'Reel/Short',     icon: '🎬', hint: 'TikTok / IG Reel / YouTube Short' },
  { id: 'twitter-thread',  label: 'X thread',       icon: '🐦', hint: 'Twitter/X thread — 8-12 tweets' },
  { id: 'landing',         label: 'Landing',        icon: '🖥', hint: 'Landing page hero + section copy' },
  { id: 'dm',              label: 'DM',             icon: '💬', hint: 'Direct message / outreach' },
  { id: 'blog',            label: 'Blog',           icon: '📝', hint: 'Long-form SEO blog post' },
  { id: 'youtube-script',  label: 'YT script',      icon: '📺', hint: 'YouTube video script — hook → value → CTA' },
];

export const STATUSES = ['draft', 'approved', 'scheduled', 'published', 'archived'] as const;
export type ContentStatus = typeof STATUSES[number];
