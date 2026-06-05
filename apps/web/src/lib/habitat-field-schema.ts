// Central source-of-truth cho list fields ext scrape per page_kind.
// Dùng bởi:
//   - apps/web/src/app/api/ext/learn-selectors/route.ts (LLM prompt + ext POST)
//   - apps/web/src/components/habitat-selectors-section.tsx (UI empty state +
//     missing field rows)
//   - public/extensions/mos2-crew/content.js (REQUIRED_FIELDS list - hardcode
//     mirror; sync khi update ở đây)
//
// Khi thêm field mới, edit cả 3 nơi.

import { BRIEF_FIELD_SCHEMAS } from './brief-field-schema';
import { VIEWER_FIELD_SCHEMAS } from './viewer-field-schema';

export interface FieldSchemaEntry {
  /** Field name khớp với spec key trong selector_overrides table. */
  key: string;
  /** Hiển thị UI + LLM prompt. */
  label: string;
  /** Mô tả LLM dùng để discover + UI tooltip. */
  hint: string;
  /** Parse hint cho LLM gợi ý (number-suffix cho '2K', date cho 'Aug 14, 2017'). */
  parse?: 'number' | 'date' | 'number-suffix' | 'enum';
  /** Enum values khi parse='enum'. */
  enumValues?: string[];
  /** Habitat row field key (nếu khác với schema key — vd created_at → created_at_source). */
  habitatKey?: string;
}

export const FIELD_SCHEMAS: Record<string, FieldSchemaEntry[]> = {
  'subreddit-about': [
    {
      key: 'title',
      label: 'Display title',
      hint: 'Display name của community ("Astrology Memes"), khác r/slug từ URL.',
      habitatKey: 'title',
    },
    {
      key: 'members',
      label: 'Members',
      hint: 'Tổng số subscribers/members ("2.3K Members" → 2300).',
      parse: 'number-suffix',
    },
    {
      key: 'weekly_visitors',
      label: 'Weekly visitors',
      hint: 'Weekly unique visitors ("2K Weekly visitors").',
      parse: 'number-suffix',
    },
    {
      key: 'weekly_contributions',
      label: 'Weekly contributions',
      hint: 'Weekly posts + comments ("280 Weekly contributions").',
      parse: 'number-suffix',
    },
    {
      key: 'privacy',
      label: 'Privacy',
      hint: 'Community type: public | restricted | private.',
      parse: 'enum',
      enumValues: ['public', 'restricted', 'private'],
    },
    {
      key: 'created_at',
      label: 'Created date',
      hint: 'Date community được tạo (vd "Created Aug 14, 2017" hoặc <time datetime>).',
      parse: 'date',
      habitatKey: 'created_at_source',
    },
    {
      key: 'description',
      label: 'Description',
      hint: 'Mô tả community (paragraph).',
    },
    {
      key: 'icon_url',
      label: 'Icon URL',
      hint: 'Subreddit icon image URL.',
    },
    {
      key: 'rules',
      label: 'Rules',
      hint: 'Posting rules list (markdown bullets). Scrape headings từ sidebar accordion.',
      habitatKey: 'postingRules',
    },
  ],
  // Signup form (Req#2) — WRITE fields (fill value vào input). Selector
  // attr mặc định = 'value' (xử lý ở save-selector route). Field lạ ngoài
  // core → extra động (slug label), KHÔNG cần khai báo ở đây.
  'signup': [
    { key: 'username', label: 'Username', hint: 'Ô username/login (input[name=username]).' },
    { key: 'email', label: 'Email', hint: 'Ô email (input[type=email]).' },
    { key: 'password', label: 'Password', hint: 'Ô password (input[type=password] đầu tiên).' },
    { key: 'password_confirm', label: 'Confirm password', hint: 'Ô nhập lại password (input[type=password] thứ 2).' },
    { key: 'display_name', label: 'Display name', hint: 'Tên hiển thị / nickname (nếu khác username).' },
    { key: 'bio', label: 'Bio', hint: 'Giới thiệu / about (textarea).' },
  ],
  // Composer (reply-assist in-page widget) — selector cho widget soạn/đăng reply +
  // đọc thread/post + ngữ cảnh reply. Cascade engine>platform>habitat. Field `_adapter`
  // (spec jsonb) chứa behavior flags: float, noPost, quoteFormat, insert, postAuthorAttr...
  'composer': [
    { key: 'composer.anchor', label: 'Neo widget', hint: 'Element để gắn thanh assist (dưới/trên editor). Vd .formButtonGroup (XenForo), reddit-rte.' },
    { key: 'composer.editor', label: 'Ô soạn (WRITE)', hint: 'Ô nhập reply: textarea / contenteditable. Vd .fr-element, reddit-rte [contenteditable].' },
    { key: 'composer.postBtn', label: 'Nút Đăng', hint: 'Nút submit reply (forum). Reddit để trống (noPost).' },
    { key: 'thread.title', label: 'Tiêu đề thread', hint: 'h1 tiêu đề bài/thread.' },
    { key: 'post.item', label: 'Post (1 bài)', hint: 'Element bao 1 post/comment. Vd article.message, shreddit-comment.' },
    { key: 'post.author', label: 'Author post', hint: 'Tên người đăng trong 1 post.' },
    { key: 'post.permalink', label: 'Permalink post', hint: 'Link tới 1 post (post-NNN / /comments/...).' },
    { key: 'parent.container', label: 'Bài đang reply', hint: 'Comment/post mà reply nhắm tới (Reddit: ancestor comment).' },
    { key: 'reactions', label: 'Reactions', hint: 'Số like/reaction của 1 post (track metrics).' },
    { key: 'replyAction', label: 'Nút Reply', hint: 'Action "Reply"/quote trên 1 post (follow-up).' },
    { key: 'breadcrumb', label: 'Breadcrumb sub-forum', hint: 'Link sub-forum trong breadcrumb (forum).' },
    { key: '_adapter', label: 'Behavior (JSON)', hint: 'Cấu hình: { float, noPost, quoteFormat:bbcode|reddit-parent, insert:append, postAuthorAttr }.' },
  ],
  // Future: subreddit-rules, fb-group-about, discord-server-about ...
};

// Field signup là interaction WRITE → selector cần attr='value' (fill), khác
// các page_kind READ (textContent/parse). save-selector dùng để default attr.
export const WRITE_PAGE_KINDS = new Set(['signup']);

export function getFieldSchema(pageKind: string): FieldSchemaEntry[] {
  return FIELD_SCHEMAS[pageKind] ?? [];
}

export function getFieldHint(pageKind: string, field: string): string {
  // Brief fields prefixed with "brief.<key>" → lookup brief schema.
  if (field.startsWith('brief.')) {
    const briefKey = field.slice('brief.'.length);
    const entry = BRIEF_FIELD_SCHEMAS[pageKind]?.find((f) => f.key === briefKey);
    if (entry) return `[BRIEF/viewer-relationship] ${entry.hint}`;
  }
  // Viewer fields prefixed with "viewer.<key>" → lookup viewer schema
  // (page_kind='platform-any', không tied to specific habitat page).
  if (field.startsWith('viewer.')) {
    const viewerKey = field.slice('viewer.'.length);
    const entry = VIEWER_FIELD_SCHEMAS['platform-any']?.find((f) => f.key === viewerKey);
    if (entry) return `[VIEWER/platform-login] ${entry.hint}`;
  }
  return FIELD_SCHEMAS[pageKind]?.find((f) => f.key === field)?.hint ?? 'extract value';
}
