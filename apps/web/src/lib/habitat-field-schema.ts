// Central source-of-truth cho list fields ext scrape per page_kind.
// Dùng bởi:
//   - apps/web/src/app/api/ext/learn-selectors/route.ts (LLM prompt + ext POST)
//   - apps/web/src/components/habitat-selectors-section.tsx (UI empty state +
//     missing field rows)
//   - public/extensions/mos2-crew/content.js (REQUIRED_FIELDS list - hardcode
//     mirror; sync khi update ở đây)
//
// Khi thêm field mới, edit cả 3 nơi.

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
  ],
  // Future: subreddit-rules, fb-group-about, discord-server-about ...
};

export function getFieldSchema(pageKind: string): FieldSchemaEntry[] {
  return FIELD_SCHEMAS[pageKind] ?? [];
}

export function getFieldHint(pageKind: string, field: string): string {
  return FIELD_SCHEMAS[pageKind]?.find((f) => f.key === field)?.hint ?? 'extract value';
}
