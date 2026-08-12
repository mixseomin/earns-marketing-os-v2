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
  { id: 'fb-group',        label: 'FB group',       icon: '👥', hint: 'Bài trong group (của mình hoặc group khác) — hỏi-đáp, link ở comment đầu' },
  { id: 'reddit',          label: 'Reddit',         icon: '👽', hint: 'Comment/text post trên subreddit — value-first, thường 0 link' },
];

export const STATUSES = ['draft', 'approved', 'scheduled', 'published', 'archived'] as const;
export type ContentStatus = typeof STATUSES[number];

// ── Content angles ────────────────────────────────────────────────────────────
// GÓC của bài = bài này LÀM GÌ cho người đọc. Trục thứ 5, không thay channel
// (nơi đăng) / status (đang ở đâu) / format / pillar (định vị).
// Lưu trong content_pieces.tags dạng 'angle:<code>' → không cần migration, ô
// search sẵn có lọc được ngay. Catalog đầy đủ 32 angle + nguồn sinh nội dung:
// earns-strategy/resources/content-angles.md.
export const ANGLE_GROUPS: Array<{ id: string; label: string; color: string; angles: string[] }> = [
  { id: 'reach',     label: 'HÚT',         color: 'var(--neon-amber)', angles: ['meme-curated', 'meme-original', 'news-hook', 'ranking', 'visual', 'hot-take', 'seasonal', 'alert', 'prediction', 'trend-jack'] },
  { id: 'trust',     label: 'TIN',         color: 'var(--neon-cyan)',  angles: ['data-point', 'comparison', 'explainer', 'myth-bust', 'how-to', 'checklist', 'answer', 'case-study', 'teardown'] },
  { id: 'convert',   label: 'CHUYỂN ĐỔI',  color: 'var(--ok)',         angles: ['tool-demo', 'use-case', 'changelog', 'offer', 'freebie'] },
  { id: 'community', label: 'CỘNG ĐỒNG',   color: 'var(--neon-pink)',  angles: ['poll', 'ugc', 'testimonial', 'collab', 'quiz', 'ama'] },
  { id: 'reuse',     label: 'TÁI DÙNG',    color: 'var(--fg-3)',       angles: ['evergreen-repost', 'roundup'] },
];

const ANGLE_TO_GROUP = new Map(ANGLE_GROUPS.flatMap((g) => g.angles.map((a) => [a, g] as const)));

// Lược đồ tag của content_pieces — MỘT chỗ định nghĩa, mọi nơi đọc qua đây (trước có 2 bộ parse
// rời nhau nên 'asset:card.png' vs 'asset:media:61' âm thầm lệch, drawer báo "chưa có" mà không ai biết).
//   angle:<code> · src:<S1..S8> · cta:<path> · place:<habitat> · time:<HH:MM>
//   acct:<id> · browser:<id> · asset:media:<id,id> · chain:<taskId,taskId>
export const tagVal = (tags: string[], k: string) => tags.find((t) => t.startsWith(`${k}:`))?.slice(k.length + 1).trim() ?? '';
/** Danh sách id trong tag dạng 'khoá:media:1,2' hoặc 'khoá:1,2'. Giá trị không phải số → bỏ. */
export const tagIds = (tags: string[], k: string) => tagVal(tags, k).replace(/^media:/, '').split(',').map(Number).filter(Number.isFinite).filter(Boolean);

/** 'angle:ranking' trong tags → {angle, group}. Không có tag angle → null. */
export function angleOf(tags: string[]): { angle: string; group: typeof ANGLE_GROUPS[number] } | null {
  const angle = tagVal(tags, 'angle');
  if (!angle) return null;
  const group = ANGLE_TO_GROUP.get(angle);
  return group ? { angle, group } : null;
}

/** Tỉ lệ mix mục tiêu (bài mới, chưa có audience → nặng HÚT). Dùng để so với thực tế. */
export const MIX_TARGET: Record<string, number> = { reach: 40, trust: 35, convert: 15, community: 10 };
