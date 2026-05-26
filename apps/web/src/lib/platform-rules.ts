// Platform-specific rules cho content_type: char limit, supported types,
// field requirements, preview hints. Centralize ở đây để UI + validator +
// preview cùng dùng. Khi platform thay đổi limit (vd Twitter premium 25k
// chars), sửa 1 chỗ.
//
// Use:
//   const r = getPlatformRules('reddit', 'text');
//   if (body.length > r.bodyMax) → warn
//   r.supportedTypes → filter content_type picker

export interface PlatformContentRules {
  /** Max characters của title (0 = không có title field hoặc unlimited). */
  titleMax: number;
  /** Min chars của title (0 = optional). */
  titleMin: number;
  /** Max characters của body. */
  bodyMax: number;
  /** Min chars của body. */
  bodyMin: number;
  /** Note cho user về limit / convention. */
  hint: string;
  /** Có cần media attached? */
  mediaRequired: boolean;
  /** Optional: max bullet count, max paragraphs, etc. */
  notes?: string[];
}

export interface PlatformRules {
  /** Platform display name */
  label: string;
  /** Content types supported (subset của CONTENT_FORMATS keys). */
  supportedTypes: string[];
  /** Per content_type rules. */
  byType: Record<string, PlatformContentRules>;
  /** Platform-specific extra fields (vd Reddit flair, FB privacy). */
  extraFields?: PlatformExtraField[];
}

export interface PlatformExtraField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'url';
  options?: string[];
  hint: string;
  /** Chỉ require/show với content_types này. Empty = mọi type. */
  appliesTo?: string[];
}

// Reddit: text/link/image/video posts + comments. Title required (text post).
// Char limits: title 300, body 40k chars, comment 10k.
// Refs: https://www.reddit.com/wiki/markdown
const REDDIT: PlatformRules = {
  label: 'Reddit',
  supportedTypes: ['text', 'link', 'image', 'video', 'poll', 'comment', 'reply'],
  byType: {
    text:    { titleMin: 5, titleMax: 300, bodyMin: 0,   bodyMax: 40000, mediaRequired: false, hint: 'Title bắt buộc 5-300 chars. Body markdown, 0-40k. Self-post = no link auto.' },
    link:    { titleMin: 5, titleMax: 300, bodyMin: 0,   bodyMax: 0,     mediaRequired: false, hint: 'Title + URL only. Không có body (chỉ comment seeding mồi sau).' },
    image:   { titleMin: 5, titleMax: 300, bodyMin: 0,   bodyMax: 500,   mediaRequired: true,  hint: 'Title + ảnh chính. Caption optional ngắn. Ảnh 20MB max.' },
    video:   { titleMin: 5, titleMax: 300, bodyMin: 0,   bodyMax: 500,   mediaRequired: true,  hint: 'Title + video (mp4 < 1GB, < 15 min). Auto-uploaded host của Reddit.' },
    poll:    { titleMin: 5, titleMax: 300, bodyMin: 0,   bodyMax: 1000,  mediaRequired: false, hint: '2-6 options, 25 chars each. Duration 1-7 ngày.' },
    comment: { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 10000, mediaRequired: false, hint: 'Comment reply trong thread/sub-comment. Không có title. Markdown OK.' },
    reply:   { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 10000, mediaRequired: false, hint: 'Reply câu hỏi cụ thể (mention OP nếu cần). Same rules với comment.' },
  },
  extraFields: [
    { key: 'flair', label: 'Flair', type: 'text', hint: 'Sub flair (nếu sub require). Kiểm tra /r/<sub>/about/flairs.',
      appliesTo: ['text', 'link', 'image', 'video', 'poll'] },
  ],
};

// Facebook: post (text/image/video/link/carousel), comment/reply.
// Char limits: post 63206, comment 8000.
const FACEBOOK: PlatformRules = {
  label: 'Facebook',
  supportedTypes: ['text', 'image', 'video', 'link', 'carousel', 'story', 'comment', 'reply'],
  byType: {
    text:     { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 63206, mediaRequired: false, hint: 'FB post text-only. Không có title. Tốt nhất < 80 chars hook + paragraph ngắn.' },
    image:    { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 63206, mediaRequired: true,  hint: 'Caption + 1 ảnh. Aspect 1:1 hoặc 4:5 ưu tiên feed.' },
    video:    { titleMin: 0, titleMax: 100, bodyMin: 0,   bodyMax: 63206, mediaRequired: true,  hint: 'Video < 4GB, < 240 min. Sub-title hiển thị nếu có.' },
    link:     { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 63206, mediaRequired: false, hint: 'Caption + link preview auto. Không can thiệp link card title.' },
    carousel: { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 63206, mediaRequired: true,  hint: 'Multi-image (2-10 ảnh). Mỗi slide tag link riêng được nếu boost ads.' },
    story:    { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 250,   mediaRequired: true,  hint: 'Vertical 9:16, expires 24h. Sticker/poll/link OK.' },
    comment:  { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 8000,  mediaRequired: false, hint: 'Comment dưới post/Q. Emoji + mention OK.' },
    reply:    { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 8000,  mediaRequired: false, hint: 'Reply câu hỏi FB Q-post. Có thể tag OP.' },
  },
  extraFields: [
    { key: 'privacy', label: 'Quyền xem', type: 'select', options: ['public', 'friends', 'group-only', 'page'],
      hint: 'Public / friends / group-only / page. Áp dụng cho post mới.',
      appliesTo: ['text', 'image', 'video', 'link', 'carousel'] },
  ],
};

// Twitter/X: post (text/image/video/link), thread, comment/reply.
// Char limits: 280 (free), 25k (premium). Default 280.
const TWITTER: PlatformRules = {
  label: 'X (Twitter)',
  supportedTypes: ['text', 'image', 'video', 'link', 'thread', 'poll', 'comment', 'reply'],
  byType: {
    text:    { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 280,   mediaRequired: false, hint: '280 chars / tweet (free). Premium 25k. Mention + hashtag + emoji counts.' },
    image:   { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 280,   mediaRequired: true,  hint: 'Caption + 1-4 ảnh. Alt text required cho accessibility.' },
    video:   { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 280,   mediaRequired: true,  hint: 'Video 512MB max, 2:20 min (free).' },
    link:    { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 280,   mediaRequired: false, hint: 'Link auto-shortened (t.co). Card preview hiện nếu có meta.' },
    thread:  { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 280,   mediaRequired: false, hint: 'Mỗi tweet ≤ 280 chars. Tweet 1 = hook. Quote nhau qua "↓".', notes: ['Tweet 1: hook strong', 'Số tweet 5-15 lý tưởng', 'Tweet cuối: CTA/link'] },
    poll:    { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 280,   mediaRequired: false, hint: '2-4 options, 25 chars each. Duration 5 min - 7 ngày.' },
    comment: { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 280,   mediaRequired: false, hint: 'Reply tweet — bám quote thread. Same 280 limit.' },
    reply:   { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 280,   mediaRequired: false, hint: 'Reply câu hỏi/tweet. Mention OP visible.' },
  },
};

// Discord: text message, embeds, thread reply.
const DISCORD: PlatformRules = {
  label: 'Discord',
  supportedTypes: ['text', 'image', 'video', 'link', 'comment', 'reply'],
  byType: {
    text:    { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 2000,  mediaRequired: false, hint: '2000 chars / message (free). Nitro 4000. Markdown OK.' },
    image:   { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 2000,  mediaRequired: true,  hint: 'Attach 1-10 ảnh, 25MB each (Nitro 50MB).' },
    video:   { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 2000,  mediaRequired: true,  hint: 'Video attached, 25MB free.' },
    link:    { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 2000,  mediaRequired: false, hint: 'Embed preview auto. Disable bằng <url>.' },
    comment: { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 2000,  mediaRequired: false, hint: 'Reply trong thread / reply 1 message bằng "Reply" feature.' },
    reply:   { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 2000,  mediaRequired: false, hint: 'Trả lời message Q (mention via @).' },
  },
  extraFields: [
    { key: 'channel', label: 'Channel', type: 'text', hint: '#channel name (nếu nhiều channel trong server)' },
  ],
};

// LinkedIn: post (text/image/video/article), comment/reply.
const LINKEDIN: PlatformRules = {
  label: 'LinkedIn',
  supportedTypes: ['text', 'image', 'video', 'link', 'doc', 'carousel', 'comment', 'reply'],
  byType: {
    text:     { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 3000,  mediaRequired: false, hint: 'Post 3000 chars. Hook line đầu (truncate ~200 chars).' },
    image:    { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 3000,  mediaRequired: true,  hint: '1-9 ảnh. Aspect 1:1 / 1.91:1 mobile-friendly.' },
    video:    { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 3000,  mediaRequired: true,  hint: 'Native video 5GB / 10 min. Captions explicit.' },
    link:     { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 3000,  mediaRequired: false, hint: 'Link card auto-preview.' },
    doc:      { titleMin: 5, titleMax: 150, bodyMin: 0,   bodyMax: 110000, mediaRequired: false, hint: 'LinkedIn Article — title + body 110k. Tốt cho long-form authority.' },
    carousel: { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 3000,  mediaRequired: true,  hint: 'PDF carousel hoặc multi-image (1-9 slide).' },
    comment:  { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 1250,  mediaRequired: false, hint: 'Comment 1250 chars. Mention + hashtag visible.' },
    reply:    { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 1250,  mediaRequired: false, hint: 'Reply câu hỏi LinkedIn — formal hơn FB.' },
  },
};

// Forum (vBulletin / phpBB / Discourse): thread post + reply.
const FORUM: PlatformRules = {
  label: 'Forum',
  supportedTypes: ['text', 'link', 'image', 'doc', 'comment', 'reply'],
  byType: {
    text:    { titleMin: 5, titleMax: 200, bodyMin: 50,  bodyMax: 30000, mediaRequired: false, hint: 'Thread title + body BBCode/markdown. Long-form OK.' },
    link:    { titleMin: 5, titleMax: 200, bodyMin: 30,  bodyMax: 30000, mediaRequired: false, hint: 'Title + link + reasoning. Đa số forum cấm pure link.' },
    image:   { titleMin: 5, titleMax: 200, bodyMin: 0,   bodyMax: 10000, mediaRequired: true,  hint: 'Image attached + caption. Imgur/upload tuỳ forum.' },
    doc:     { titleMin: 5, titleMax: 200, bodyMin: 200, bodyMax: 50000, mediaRequired: false, hint: 'Guide/tutorial dài. Heading + TOC + screenshots.' },
    comment: { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 20000, mediaRequired: false, hint: 'Reply thread. Quote OP nếu cần.' },
    reply:   { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 20000, mediaRequired: false, hint: 'Reply câu hỏi cụ thể.' },
  },
};

// Default fallback (other platforms).
const GENERIC: PlatformRules = {
  label: 'Other',
  supportedTypes: ['text', 'image', 'video', 'link', 'thread', 'poll', 'carousel', 'story', 'doc', 'comment', 'reply'],
  byType: {
    text:    { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 10000, mediaRequired: false, hint: 'Generic — không biết platform limits.' },
    image:   { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 10000, mediaRequired: true,  hint: '1 ảnh + caption.' },
    video:   { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 10000, mediaRequired: true,  hint: '1 video.' },
    link:    { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 10000, mediaRequired: false, hint: 'Link + caption.' },
    thread:  { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 10000, mediaRequired: false, hint: 'Multi-post chain.' },
    poll:    { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 1000,  mediaRequired: false, hint: 'Poll question + options.' },
    carousel:{ titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 10000, mediaRequired: true,  hint: 'Multi-slide.' },
    story:   { titleMin: 0, titleMax: 0,   bodyMin: 0,   bodyMax: 500,   mediaRequired: true,  hint: '9:16 vertical, ephemeral.' },
    doc:     { titleMin: 0, titleMax: 200, bodyMin: 0,   bodyMax: 100000, mediaRequired: false, hint: 'Long-form document.' },
    comment: { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 10000, mediaRequired: false, hint: 'Comment.' },
    reply:   { titleMin: 0, titleMax: 0,   bodyMin: 1,   bodyMax: 10000, mediaRequired: false, hint: 'Reply.' },
  },
};

const PLATFORM_RULES: Record<string, PlatformRules> = {
  reddit:   REDDIT,
  facebook: FACEBOOK,
  fb:       FACEBOOK,
  twitter:  TWITTER,
  x:        TWITTER,
  discord:  DISCORD,
  slack:    DISCORD,
  telegram: DISCORD,
  linkedin: LINKEDIN,
  forum:    FORUM,
};

export function getPlatformRules(platformKey: string | null | undefined): PlatformRules {
  const key = (platformKey ?? '').toLowerCase().trim();
  return PLATFORM_RULES[key] ?? GENERIC;
}

export function getContentRules(
  platformKey: string | null | undefined,
  contentType: string,
): PlatformContentRules {
  const plat = getPlatformRules(platformKey);
  return plat.byType[contentType] ?? GENERIC.byType[contentType] ?? GENERIC.byType.text!;
}

/** Trả supported content types cho platform. */
export function getSupportedTypes(platformKey: string | null | undefined): string[] {
  return getPlatformRules(platformKey).supportedTypes;
}

/** Validate body + title — trả missing + warnings (over limit). */
export interface ContentValidation {
  ok: boolean;
  errors: string[];          // critical: body empty/over hard limit
  warnings: string[];        // soft: under recommended, near limit
}

export function validateContent(
  platformKey: string | null | undefined,
  contentType: string,
  title: string,
  body: string,
  hasMedia: boolean,
): ContentValidation {
  const r = getContentRules(platformKey, contentType);
  const errors: string[] = [];
  const warnings: string[] = [];
  const titleLen = title.trim().length;
  const bodyLen = body.trim().length;

  if (r.titleMin > 0 && titleLen < r.titleMin) errors.push(`Title cần ≥ ${r.titleMin} chars`);
  if (r.titleMax > 0 && titleLen > r.titleMax) errors.push(`Title quá ${r.titleMax} chars (đang ${titleLen})`);
  if (r.bodyMin > 0 && bodyLen < r.bodyMin) errors.push(`Body cần ≥ ${r.bodyMin} chars`);
  if (bodyLen > r.bodyMax) errors.push(`Body quá ${r.bodyMax} chars (đang ${bodyLen})`);
  if (r.mediaRequired && !hasMedia) errors.push('Yêu cầu media (ảnh/video) attached');

  // Warning khi gần limit (80%+)
  if (r.bodyMax > 0 && bodyLen > r.bodyMax * 0.85 && bodyLen <= r.bodyMax) {
    warnings.push(`Body gần limit (${bodyLen}/${r.bodyMax})`);
  }
  if (r.titleMax > 0 && titleLen > r.titleMax * 0.85 && titleLen <= r.titleMax) {
    warnings.push(`Title gần limit (${titleLen}/${r.titleMax})`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
