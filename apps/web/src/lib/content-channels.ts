// Content channel + status catalogs. Plain constants — exported từ
// non-'use server' file để Next.js không wrap thành server action proxies
// (gây "s.filter is not a function" client-side).

import { subOf, subName } from './reddit-subs';

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

// ── Kiểu TRÌNH BÀY (style) ────────────────────────────────────────────────────
// Khác `format` (cơ chế đăng: runner bấm nút nào) và khác `angle` (bài làm gì cho người đọc).
// `style` = HÌNH DẠNG của chữ. Cùng angle data-point, cùng format photo, nhưng viết thành dòng
// hoá đơn, bản tin khẩn hay đoạn hội thoại thì lướt qua là hai bài khác hẳn nhau — feed toàn một
// khuôn "hook / giải thích / CTA" thì tới bài thứ tư người ta đã lướt qua không đọc.
export const STYLES: Array<{ id: string; label: string; icon: string; hint: string }> = [
  { id: 'plain',      label: 'Kể thẳng',       icon: '¶',  hint: '2-3 câu, không trang trí' },
  { id: 'oneliner',   label: 'Một câu',        icon: '·',  hint: 'Đúng một câu, không CTA, không giải thích' },
  { id: 'receipt',    label: 'Dòng LES',       icon: '🧾', hint: 'Dựng như dòng trên bảng lương/hoá đơn' },
  { id: 'ascii',      label: 'Bảng ký tự',     icon: '▤',  hint: 'Biểu đồ/bảng vẽ bằng ký tự, đọc được trên mọi máy' },
  { id: 'dialogue',   label: 'Hội thoại',      icon: '💬', hint: 'Hai người nói chuyện, không lời dẫn' },
  { id: 'quiz',       label: 'Câu đố',         icon: '❓', hint: 'Hỏi, đáp án ở comment' },
  { id: 'countdown',  label: 'Đếm ngược',      icon: '⏱', hint: '3 → 2 → 1, mỗi bậc một ý' },
  { id: 'glossary',   label: 'Mục từ điển',    icon: '📖', hint: 'Từ · loại · nghĩa · ví dụ' },
  { id: 'newsflash',  label: 'Bản tin khẩn',   icon: '📰', hint: 'Giọng bản tin, viết hoa mở đầu' },
  { id: 'forecast',   label: 'Dự báo',         icon: '🌡', hint: 'Kiểu dự báo thời tiết cho số liệu' },
  { id: 'checklist',  label: 'Gạch đầu dòng',  icon: '☑',  hint: 'Danh sách ngắn, mỗi dòng một việc' },
  { id: 'letter',     label: 'Thư gửi',        icon: '✉',  hint: 'Thư ngắn gửi một người/một nhóm' },
  { id: 'sidebyside', label: 'Hai cột',        icon: '⇄',  hint: 'So sánh song song bằng dấu |' },
  { id: 'errorlog',   label: 'Báo lỗi giả',    icon: '⛔', hint: 'Dựng như thông báo lỗi hệ thống' },
  { id: 'haiku',      label: 'Thơ ngắn',       icon: '🍃', hint: '3 dòng, không giải thích' },
  { id: 'review',     label: 'Đánh giá sao',   icon: '★',  hint: 'Kiểu review 1 sao / 5 sao' },
];
export const styleOf = (tags: string[]) => STYLES.find((x) => x.id === tagVal(tags, 'style')) ?? null;
export const formatOf = (tags: string[]) => FORMATS.find((f) => f.id === tagVal(tags, 'format')) ?? null;

// ── Tuỳ chọn của chính composer Facebook (đọc từ Business Suite của Page thật, 2026-08-13) ────
// Chép đúng những gì composer đưa ra, không suy diễn: bài Page KHÔNG kèm link chỉ có 4 nút này —
// không có "Learn more". Nút Learn more/Shop now là chuyện của bài có link đính kèm và bài quảng
// cáo, chưa kiểm nên chưa đưa vào đây.
export const FB_BUTTONS = [
  { id: 'none', label: 'Không nút' },
  { id: 'message', label: 'Nhắn tin' },
  { id: 'whatsapp', label: 'Nhắn WhatsApp' },
  { id: 'call', label: 'Gọi ngay' },
] as const;
export const fbButtonOf = (tags: string[]) => FB_BUTTONS.find((b) => b.id === tagVal(tags, 'btn') && b.id !== 'none') ?? null;

// ── Series (chuỗi lặp lại) ────────────────────────────────────────────────────
// Người ta không follow bài lẻ, họ follow MỘT LỜI HỨA LẶP LẠI: cùng khuôn, cùng thứ trong tuần.
// Đây là 'modifier' chồng lên bất kỳ angle/format nào (catalog content-angles.md gọi đúng tên đó),
// KHÔNG phải angle thứ 33. Lưu 'series:<id>'; sai thứ là mất luôn tác dụng lặp nên pieceGaps bắt.
export const SERIES: Array<{ id: string; label: string; weekday: number; hint: string }> = [
  { id: 'two-zips', label: 'Two zips',            weekday: 1, hint: 'Cùng cấp bậc, hai mã bưu chính, chênh bao nhiêu một năm' },
  { id: 'les-line', label: 'One line on your LES', weekday: 4, hint: 'Mỗi tuần mổ đúng một dòng trên phiếu lương' },
];
export const seriesOf = (tags: string[]) => SERIES.find((x) => x.id === tagVal(tags, 'series')) ?? null;
const VN_DAY = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];

export const STATUSES = ['draft', 'approved', 'scheduled', 'published', 'archived'] as const;
export type ContentStatus = typeof STATUSES[number];

// 'Đã đăng' là lời KHẲNG ĐỊNH bài có thật ngoài đời — không có link thì không ai kiểm được, và lịch
// in ra '✓ Đã đăng · chưa lưu link bài', một câu tự mâu thuẫn (bài 153 nằm như thế từ dữ liệu diễn
// tập). Cùng học thuyết với plays: đóng việc phải có KẾT QUẢ. Email/DM không sinh URL công khai nên
// miễn; các kênh còn lại đều có permalink.
const NO_PUBLIC_URL = new Set(['email', 'dm']);
export function publishedNeedsUrl(channel: string, status?: string | null, url?: string | null): boolean {
  return status === 'published' && !NO_PUBLIC_URL.has(channel) && !(url ?? '').trim();
}
export const PUBLISHED_NEEDS_URL_MSG = 'Đánh dấu Đã đăng thì phải lưu link bài — dán link rồi lưu lại.';

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

// Mã angle trần ('meme-curated') không nói bài LÀM GÌ — mà đó mới là câu hỏi lúc đọc lịch. Tên gọn
// + mục đích một dòng, chép từ cột "Là gì" của catalog (earns-strategy/resources/content-angles.md).
export const ANGLES: Record<string, { label: string; purpose: string }> = {
  'meme-curated':     { label: 'Meme share lại',      purpose: 'Share meme của cộng đồng, giữ credit' },
  'meme-original':    { label: 'Meme tự dựng',        purpose: 'Meme dựng từ data của mình' },
  'news-hook':        { label: 'Bám tin ngành',       purpose: 'Tin dưới 48h + ảnh hưởng gì tới người đọc' },
  ranking:            { label: 'Xếp hạng',            purpose: 'Top N, đắt nhất - rẻ nhất, sinh từ bảng dữ liệu' },
  visual:             { label: 'Ảnh / biểu đồ',       purpose: 'Một hình đứng một mình đủ hiểu' },
  'hot-take':         { label: 'Quan điểm ngược',     purpose: 'Nói ngược số đông, có số chứng minh' },
  seasonal:           { label: 'Bám mốc lịch',        purpose: 'Ngày lương, mùa thuế, ngày ra rate mới' },
  alert:              { label: 'Cảnh báo gấp',        purpose: 'Có việc phải làm ngay, không chỉ để biết' },
  prediction:         { label: 'Dự báo',              purpose: 'Cái sắp tới, có căn cứ' },
  'trend-jack':       { label: 'Bám trend nền tảng',  purpose: 'Mượn format/audio đang viral của nền tảng' },
  'data-point':       { label: 'Một con số',          purpose: 'Một con số và vì sao nó quan trọng' },
  comparison:         { label: 'So sánh A/B',         purpose: 'Nơi này với nơi kia, gói này với gói kia' },
  explainer:          { label: 'Giải thích cơ chế',   purpose: 'Thứ này hoạt động thế nào' },
  'myth-bust':        { label: 'Đập hiểu lầm',        purpose: 'Sửa hiểu lầm phổ biến, kèm số' },
  'how-to':           { label: 'Hướng dẫn làm',       purpose: 'Các bước làm được ngay hôm nay' },
  checklist:          { label: 'Danh sách để lưu',    purpose: 'Danh sách ngắn người ta lưu lại dùng' },
  answer:             { label: 'Trả lời câu hỏi thật',purpose: 'Đáp đúng câu cộng đồng đang hỏi' },
  'case-study':       { label: 'Người thật việc thật',purpose: 'Người thật, số thật, kết quả thật' },
  teardown:           { label: 'Mổ xẻ thứ bên ngoài', purpose: 'Soi tool đối thủ, form cơ quan, tài liệu chính sách' },
  'tool-demo':        { label: 'Demo công cụ',        purpose: 'Thao tác ra kết quả trong 10 giây' },
  'use-case':         { label: 'Tình huống dùng',     purpose: 'Tình huống X ra số Y ra quyết định Z' },
  changelog:          { label: 'Nhật ký build',       purpose: 'Vừa thêm gì, sửa gì, vì sao' },
  offer:              { label: 'Lời mời',             purpose: 'Mời đăng ký, mua, nhận cập nhật' },
  freebie:            { label: 'Quà tải về',          purpose: 'Cheat-sheet, template đổi lấy email' },
  poll:               { label: 'Bình chọn',           purpose: 'Hỏi một câu, 3-4 lựa chọn, lấy insight' },
  ugc:                { label: 'Bài của người dùng',  purpose: 'Khoe kết quả, đóng góp của người dùng' },
  testimonial:        { label: 'Lời chứng thực',      purpose: 'Người thật nói tốt, có kiểm chứng' },
  collab:             { label: 'Bắt tay chéo',        purpose: 'Cross-promo với creator/page cùng ngách' },
  quiz:               { label: 'Câu đố có đáp án',    purpose: 'Đố đúng/sai, đáp án ở comment' },
  ama:                { label: 'Hỏi đáp mở',          purpose: 'Mở hỏi-đáp theo khung giờ' },
  'evergreen-repost': { label: 'Đăng lại bài top',    purpose: 'Bài top sau 60-90 ngày, đổi hook và ảnh' },
  roundup:            { label: 'Tổng hợp kỳ',         purpose: 'Gom nhiều mẩu nhỏ thành tổng hợp tuần/tháng' },
};
export const angleLabel = (code: string) => ANGLES[code]?.label ?? code;

const ANGLE_TO_GROUP = new Map(ANGLE_GROUPS.flatMap((g) => g.angles.map((a) => [a, g] as const)));

// Lược đồ tag của content_pieces — MỘT chỗ định nghĩa, mọi nơi đọc qua đây (trước có 2 bộ parse
// rời nhau nên 'asset:card.png' vs 'asset:media:61' âm thầm lệch, drawer báo "chưa có" mà không ai biết).
//   angle:<code> · format:<id> · style:<id> · src:<S1..S8> · cta:<path> · place:<habitat> · time:<HH:MM>
//   acct:<id> · browser:<id> · asset:media:<id,id> · chain:<taskId,taskId>
//   replyto:<pieceId> (comment đầu của bài đó) · linkcheck:ok|bad
//   platsched:<id|1> (nền tảng đã nhận lịch) · story:1 (kèm Facebook story) · btn:<id trong FB_BUTTONS>
//   flair:<text> (flair Reddit) · rdtag:oc,nsfw,spoiler (nhãn Reddit) · series:<id trong SERIES>
export const tagVal = (tags: string[], k: string) => tags.find((t) => t.startsWith(`${k}:`))?.slice(k.length + 1).trim() ?? '';
/** Danh sách id trong tag dạng 'khoá:media:1,2' hoặc 'khoá:1,2'. Giá trị không phải số → bỏ. */
/** Tệp này có phải VIDEO không — dùng CHUNG cho bản dựng, kho, picker và bảng thiếu-nguyên-liệu.
 *  Ba chỗ từng kiểm ba kiểu (chỗ xem `kind`, chỗ xem `mimeType`): asset kind='video' mà mime rỗng
 *  (thêm bằng URL ngoài, HEAD bị CORS chặn) thì kho phát được còn bản dựng ra ô vỡ. Một hàm, hết lệch. */
/** Tag mà GIÁ TRỊ chứa dấu phẩy (asset:media:61,62 · chain:88,90 · rdtag:oc,spoiler). Ô nhập tag
 *  dạng "a, b, c" cắt theo dấu phẩy nên KHÔNG được cho mấy tag này đi qua đó — chúng do drawer quản
 *  bằng picker. Form soạn bài giữ nguyên chúng, không đụng vào. */
export const COMMA_VALUE_TAG = /^(asset|chain|rdtag):/;

export const isVideoMedia = (m: { kind?: string | null; mimeType?: string | null; filename?: string | null; url?: string } | null | undefined): boolean =>
  !!m && (m.kind === 'video' || !!m.mimeType?.startsWith('video/') || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(m.filename || m.url || ''));

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
/** Kênh đăng ra ngoài cho người lạ đọc. `dm`/`email` không nằm đây: thư riêng viết tiếng gì là
 *  tuỳ người nhận. */
const PUBLIC_CHANNELS = new Set(['fb-post', 'fb-group', 'reddit', 'twitter-thread', 'reel', 'youtube-script', 'blog', 'ad', 'landing']);

export function pieceGaps(
  piece: { channel?: string; tags: string[]; hasBody?: boolean; body?: string; date?: string },
  refs: {
    accounts?: Array<{ id: number; browserProfileId?: number | null; status: string }>;
    browserProfiles?: Array<{ id: number; lastOpenedAt?: string | Date | null }>;
    media?: Array<{ id: number; kind?: string; mimeType?: string | null; filename?: string }>;
    tasks?: Array<{ id: number; siteState: string; siteScheduledAt?: string | null }>;
    /** 'YYYY-MM-DD' hôm nay — để phân biệt "chưa tới lượt làm" với "tới hạn mà chưa xong". */
    today?: string;
  } = {},
): string[] {
  // Đã đẩy vào LỊCH CỦA NỀN TẢNG (FB nhận rồi): chữ, ảnh, giờ nằm bên đó, FB tự đăng kể cả lúc
  // máy mình tắt. Runner không cần account/phiên/asset nữa nên mọi "còn thiếu" ở đây là nhiễu.
  // Phần duy nhất còn phải trực (comment đầu) nằm ở pieceRisks, không phải chỗ này.
  if (tagVal(piece.tags, 'platsched')) return [];

  // Liệt kê theo ĐÚNG thứ tự phụ thuộc: account trước, nơi đăng sau — nơi đăng là page CỦA account,
  // báo "chưa chọn nơi đăng" lên đầu là bảo người ta đi làm cái chưa làm được.
  const gaps: string[] = [];
  if (piece.hasBody === false) gaps.push('chưa soạn nội dung');
  // Thân bài còn tiếng Việt trên kênh ĐĂNG CÔNG KHAI = chưa phải caption, mà là ghi chú nội bộ cho
  // người viết ("Bài của mình: số lấy từ data sản phẩm, 2-4 câu, 1 link"). Đăng nguyên si là lộ
  // hướng dẫn ra ngoài. Nội dung công khai của mọi project ở đây là tiếng Anh, nên chỉ cần thấy dấu
  // tiếng Việt là đủ kết luận — không phải đoán theo từ khoá.
  if (piece.body && PUBLIC_CHANNELS.has(piece.channel ?? '') && /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(piece.body))
    gaps.push('thân bài còn tiếng Việt — đó là ghi chú nội bộ, chưa phải caption');

  // Series chỉ có tác dụng khi nó RƠI ĐÚNG THỨ mỗi tuần — lệch thứ thì người đọc không đợi được,
  // và cái "lời hứa lặp lại" tan mất.
  const ser = seriesOf(piece.tags);
  if (ser && piece.date) {
    const d = new Date(`${piece.date}T12:00:00`).getDay();
    if (d !== ser.weekday) gaps.push(`series "${ser.label}" đăng ${VN_DAY[ser.weekday]}, bài này rơi vào ${VN_DAY[d]}`);
  }

  // Reddit: mỗi sub một luật khác nhau, và luật đó quyết định bài có đăng NỔI không. Sub chỉ nhận
  // bài chữ thì bài ảnh/poll/link không có đường lên; sub bắt flair mà thiếu flair là bị gỡ sau vài
  // phút. Luật lấy từ chính Reddit (scripts/sync-reddit-subs.mjs), không chép tay.
  if (piece.channel === 'reddit') {
    const place = tagVal(piece.tags, 'place');
    const sub = place ? subOf(place) : null;
    if (sub) {
      const kind = tagVal(piece.tags, 'format');
      if (sub.submissionType === 'self' && ['link', 'photo', 'album', 'poll'].includes(kind))
        gaps.push(`r/${subName(place)} chỉ nhận bài chữ — kiểu "${kind}" không đăng được ở đây`);
      if (kind === 'poll' && !sub.allowPolls) gaps.push(`r/${subName(place)} tắt poll`);
      if ((kind === 'photo' || kind === 'album') && !sub.allowImages) gaps.push(`r/${subName(place)} không cho đăng ảnh`);
      if (sub.flairRequired && !tagVal(piece.tags, 'flair')) gaps.push(`r/${subName(place)} bắt buộc flair — chưa chọn`);
    }
  }

  const acctId = Number(tagVal(piece.tags, 'acct')) || 0;
  const acct = acctId ? refs.accounts?.find((a) => a.id === acctId) : undefined;
  if (!acctId) gaps.push('chưa gắn account');
  else if (!acct) gaps.push(`account #${acctId} không có trong vault`);
  else if (acct.status !== 'active') gaps.push(`account đang ${acct.status}`);

  // Nơi đăng của Reddit là subreddit — nơi công khai, không phải page thuộc account, nên đừng bắt
  // chọn account trước (Page Facebook mới lấy theo account).
  if (!tagVal(piece.tags, 'place'))
    gaps.push(acctId || piece.channel === 'reddit' ? 'chưa chọn nơi đăng' : 'chưa chọn nơi đăng (cần account trước)');

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

  // Link đích: 'linkcheck:bad' = đã kiểm và có link hỏng. Bài chèn link mà chưa kiểm lần nào thì
  // nhắc kiểm — trang đích không tồn tại là lỗi chỉ lộ ra sau khi đã đăng.
  const lc = tagVal(piece.tags, 'linkcheck');
  if (lc === 'bad') gaps.push('link đích hỏng (kiểm lại trang trên site)');
  else if (!lc && tagVal(piece.tags, 'format') === 'link') gaps.push('link đích chưa kiểm');

  const missingMedia = tagIds(piece.tags, 'asset').filter((id) => !refs.media?.some((m) => m.id === id));
  if (missingMedia.length) gaps.push(`asset chưa có trong vault: #${missingMedia.join(', #')}`);

  // Bài VIDEO mà tệp gắn vào là ảnh thì không có gì để đăng — và trước đây nó vẫn đếm là "đủ
  // nguyên liệu" vì chỉ kiểm asset CÓ TỒN TẠI hay không, không kiểm LOẠI. Lỗi chỉ lộ ra lúc mở
  // Reels lên rồi mới thấy không tải được. Kiểm ở đây một lần cho mọi kênh video.
  const VIDEO_FORMATS = new Set(['short', 'longform']);
  if (piece.channel === 'reel' || VIDEO_FORMATS.has(tagVal(piece.tags, 'format'))) {
    const attached = tagIds(piece.tags, 'asset')
      .map((id) => refs.media?.find((m) => m.id === id)).filter(Boolean) as Array<{ kind?: string; mimeType?: string | null; filename?: string }>;
    const hasVideo = attached.some(isVideoMedia);
    if (!hasVideo) gaps.push(attached.length ? 'bài video nhưng tệp gắn vào là ảnh — chưa có video' : 'bài video nhưng chưa gắn video');
  }

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

/** Trần tỉ lệ bài CÓ LINK. Link kéo người ra khỏi nền tảng nên nền tảng trả đũa bằng reach —
 *  Facebook nặng nhất. Feed toàn link thì cả trang bị hạ, kể cả bài không link. Mốc 25%: 3 bài
 *  nuôi quan hệ cho 1 bài dẫn đi. */
export const LINK_SHARE_MAX = 25;

/** RỦI RO PHÂN PHỐI — khác "thiếu nguyên liệu". Thiếu nguyên liệu = chạy không được; rủi ro = chạy
 *  được nhưng bài sẽ bị dìm hoặc gây hại. Tách riêng để không lẫn vào nhau lúc duyệt. */
export function pieceRisks(piece: { channel: string; tags: string[]; hasLink?: boolean }, refs: { replies?: Array<{ hasLink?: boolean }> } = {}): string[] {
  const out: string[] = [];
  const fb = piece.channel === 'fb-post' || piece.channel === 'fb-group';

  // Bài đã nằm trong lịch của FB thì FB tự đăng đúng giờ — nhưng comment đầu thì KHÔNG: composer
  // Business Suite không có ô comment đầu (kiểm 2026-08-13). Ai đó phải có mặt lúc bài tự lên.
  if (fb && tagVal(piece.tags, 'platsched') && refs.replies?.length) {
    out.push('FB không lên lịch được comment đầu — bài tự lên nhưng comment phải đăng tay ngay lúc đó');
  }

  if (piece.hasLink) {
    const lc = tagVal(piece.tags, 'linkcheck');
    if (lc === 'bad') out.push('link đích hỏng — đăng ra là gãy ngay ở cú bấm đầu tiên');
    else if (!lc) out.push('link đích chưa kiểm (bấm "Kiểm link đích")');

    // Facebook: link nằm TRONG bài là cách chắc chắn nhất để bài không được phân phối. Đường đi đúng
    // là bài chính không link, link nằm ở comment đầu — nên chỉ nhắc khi chưa có comment nào mang link.
    if (fb) {
      const hasLinkComment = refs.replies?.some((r) => r.hasLink);
      out.push(hasLinkComment
        ? 'FB: bài chính vẫn còn link dù đã có comment đầu mang link — bỏ link khỏi bài chính'
        : 'FB dìm bài có link — chuyển link xuống comment đầu, bài chính để trần');
    }
  }
  return out;
}

/** Cảnh báo trên LỊCH chỉ dành cho bài SẮP tới lượt. Bài tháng sau chưa gắn account là chuyện
 *  đương nhiên — bôi vàng hết cả tháng thì không còn là cảnh báo, chỉ là nhiễu (mọi pill đều nổi
 *  = không pill nào nổi). Trong drawer thì vẫn liệt kê đủ, vì lúc đó là mình chủ động hỏi. */
export function shouldWarnGaps(piece: { status: string; date: string }, today?: string, leadDays = 3): boolean {
  if (piece.status !== 'approved' && piece.status !== 'scheduled') return false;
  if (!today) return false;
  return Math.round((Date.parse(piece.date) - Date.parse(today)) / 864e5) <= leadDays;
}
