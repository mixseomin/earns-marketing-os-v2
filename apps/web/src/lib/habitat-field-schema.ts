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
  // Future: subreddit-rules, fb-group-about, discord-server-about ...
};

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
