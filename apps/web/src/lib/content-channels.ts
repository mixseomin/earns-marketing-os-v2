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

/** Kênh → platform_key của account đăng được kênh đó. Dùng để xếp account đúng nền tảng lên đầu
 *  khi chọn (đoán bằng cách so vài ký tự đầu là sai: 'fb-post' không bắt đầu bằng 'facebook'). */
export const CHANNEL_PLATFORM: Record<string, string> = {
  'fb-post': 'facebook', 'fb-group': 'facebook', reddit: 'reddit', 'twitter-thread': 'twitter',
  reel: 'tiktok', 'youtube-script': 'youtube',
};

// ── Kiểu bài (format) ─────────────────────────────────────────────────────────
// CÙNG một kênh vẫn đăng ra khác hẳn nhau: text trơn, ảnh đơn, album nhiều ảnh, bài chèn link,
// poll, share lại bài người khác, comment trong thread có sẵn. Khác nhau ở cái người ta NHÌN thấy
// và ở cái runner phải bấm, nên nó là trục riêng — không nhét chung vào channel (đã có 11 channel,
// nhân chéo ra là 40+ mục không ai chọn nổi). Lưu 'format:<id>' trong tags như angle.
export const FORMATS: Array<{ id: string; label: string; icon: string; channels: string[] }> = [
  { id: 'text',     label: 'Text trơn',   icon: '¶',  channels: ['fb-post', 'fb-group', 'reddit', 'twitter-thread', 'dm', 'email'] },
  { id: 'photo',    label: 'Ảnh đơn',     icon: '🖼', channels: ['fb-post', 'fb-group', 'reddit', 'twitter-thread', 'ad'] },
  { id: 'album',    label: 'Album/carousel', icon: '🎞', channels: ['fb-post', 'fb-group', 'ad', 'twitter-thread'] },
  { id: 'link',     label: 'Bài chèn link', icon: '🔗', channels: ['fb-post', 'fb-group', 'reddit', 'twitter-thread', 'email'] },
  { id: 'poll',     label: 'Poll',        icon: '📊', channels: ['fb-post', 'fb-group', 'reddit', 'twitter-thread'] },
  { id: 'share',    label: 'Share/quote lại', icon: '↻', channels: ['fb-post', 'fb-group', 'twitter-thread'] },
  { id: 'comment',  label: 'Comment trong thread', icon: '💬', channels: ['reddit', 'fb-group', 'fb-post'] },
  { id: 'thread',   label: 'Thread nhiều mảnh', icon: '🧵', channels: ['twitter-thread', 'reddit'] },
  { id: 'short',    label: 'Video dọc ngắn', icon: '📱', channels: ['reel', 'youtube-script'] },
  { id: 'longform', label: 'Video dài',   icon: '🎬', channels: ['youtube-script'] },
  { id: 'guide',    label: 'Guide',       icon: '📘', channels: ['blog'] },
  { id: 'listicle', label: 'Listicle',    icon: '☰',  channels: ['blog'] },
  { id: 'sequence', label: 'Chuỗi email', icon: '✉', channels: ['email', 'dm'] },
];

export const formatsFor = (channel: string) => FORMATS.filter((f) => f.channels.includes(channel));
export const formatOf = (tags: string[]) => FORMATS.find((f) => f.id === tagVal(tags, 'format')) ?? null;

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
//   angle:<code> · format:<id> · src:<S1..S8> · cta:<path> · place:<habitat> · time:<HH:MM>
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

/** Bài đã DUYỆT mà vẫn chạy được không — trạng thái biên tập không nói lên điều đó.
 *  Duyệt = "chữ nghĩa ổn"; chạy được = còn cần nơi đăng + account + phiên trình duyệt sống +
 *  asset + chuỗi chuẩn bị xong. Thiếu mà im lặng thì đến ngày mới biết, và biết bằng cách bài
 *  không lên. Đọc từ dữ liệu ĐÃ tải sẵn trên trang, không query thêm. */
export function pieceGaps(
  piece: { tags: string[]; hasBody?: boolean },
  refs: {
    accounts?: Array<{ id: number; browserProfileId?: number | null; status: string }>;
    browserProfiles?: Array<{ id: number; lastOpenedAt?: string | Date | null }>;
    media?: Array<{ id: number }>;
    tasks?: Array<{ id: number; siteState: string; siteScheduledAt?: string | null }>;
    /** 'YYYY-MM-DD' hôm nay — để phân biệt "chưa tới lượt làm" với "tới hạn mà chưa xong". */
    today?: string;
  } = {},
): string[] {
  // Liệt kê theo ĐÚNG thứ tự phụ thuộc: account trước, nơi đăng sau — nơi đăng là page CỦA account,
  // báo "chưa chọn nơi đăng" lên đầu là bảo người ta đi làm cái chưa làm được.
  const gaps: string[] = [];
  if (piece.hasBody === false) gaps.push('chưa soạn nội dung');

  const acctId = Number(tagVal(piece.tags, 'acct')) || 0;
  const acct = acctId ? refs.accounts?.find((a) => a.id === acctId) : undefined;
  if (!acctId) gaps.push('chưa gắn account');
  else if (!acct) gaps.push(`account #${acctId} không có trong vault`);
  else if (acct.status !== 'active') gaps.push(`account đang ${acct.status}`);

  if (!tagVal(piece.tags, 'place')) gaps.push(acctId ? 'chưa chọn nơi đăng' : 'chưa chọn nơi đăng (cần account trước)');

  // Profile lấy từ tag, không có thì lấy từ chính account — account chưa gắn profile nào thì
  // runner không biết mở phiên nào (đúng chỗ hụt của ~40 row facebook trong vault).
  const profId = Number(tagVal(piece.tags, 'browser')) || acct?.browserProfileId || 0;
  const prof = profId ? refs.browserProfiles?.find((b) => b.id === profId) : undefined;
  if (!profId) gaps.push('account chưa gắn browser profile');
  else if (!prof) gaps.push(`browser profile #${profId} không có trong vault`);
  else if (prof.lastOpenedAt) {
    const days = Math.round((Date.now() - new Date(prof.lastOpenedAt).getTime()) / 864e5);
    if (days > 30) gaps.push(`phiên trình duyệt ${days} ngày chưa mở (dễ rớt đăng nhập)`);
  }

  const missingMedia = tagIds(piece.tags, 'asset').filter((id) => !refs.media?.some((m) => m.id === id));
  if (missingMedia.length) gaps.push(`asset chưa có trong vault: #${missingMedia.join(', #')}`);

  // Card chuẩn bị CHƯA TỚI HẠN mà chưa xong thì không phải thiếu — đó là việc của tuần sau.
  // Chỉ tính là thiếu khi card biến mất, hoặc đã tới/quá hạn mà vẫn chưa xong.
  const chain = tagIds(piece.tags, 'chain');
  const open = chain.map((id) => refs.tasks?.find((x) => x.id === id))
    .filter((t) => !t || !['completed', 'verified'].includes(t.siteState));
  const late = open.filter((t) => t?.siteScheduledAt && (!refs.today || t.siteScheduledAt.slice(0, 10) <= refs.today));
  const undated = open.filter((t) => t && !t.siteScheduledAt);
  const gone = open.filter((t) => !t);
  if (late.length) gaps.push(`chuỗi chuẩn bị trễ ${late.length}/${chain.length} việc`);
  if (undated.length) gaps.push(`chuỗi chuẩn bị: ${undated.length} việc chưa đặt ngày`);
  if (gone.length) gaps.push(`${gone.length} card chuẩn bị không còn trên board`);
  return gaps;
}

/** Cảnh báo trên LỊCH chỉ dành cho bài SẮP tới lượt. Bài tháng sau chưa gắn account là chuyện
 *  đương nhiên — bôi vàng hết cả tháng thì không còn là cảnh báo, chỉ là nhiễu (mọi pill đều nổi
 *  = không pill nào nổi). Trong drawer thì vẫn liệt kê đủ, vì lúc đó là mình chủ động hỏi. */
export function shouldWarnGaps(piece: { status: string; date: string }, today?: string, leadDays = 3): boolean {
  if (piece.status !== 'approved' && piece.status !== 'scheduled') return false;
  if (!today) return false;
  return Math.round((Date.parse(piece.date) - Date.parse(today)) / 864e5) <= leadDays;
}
