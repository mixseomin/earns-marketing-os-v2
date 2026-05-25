// Brief field schema — declare các fields ext scrape về relationship
// (viewer ↔ habitat) per platform/page_kind. Song song với habitat-field-
// schema.ts nhưng cho brief metadata.
//
// Reuse selector_overrides table với prefix "brief." trong field_name để
// phân biệt với habitat fields (page_kind dùng chung 'subreddit-about').
//
// Khi thêm field mới: edit FIELD_SCHEMAS + brief-field-extractor.ts (ext).

export interface BriefFieldSchemaEntry {
  /** Field key trong scraped_meta JSONB (KHÔNG có prefix "brief."). */
  key: string;
  /** Hiển thị UI + LLM prompt. */
  label: string;
  /** Mô tả LLM dùng để discover + UI tooltip. */
  hint: string;
  /** Parse hint. */
  parse?: 'number' | 'date' | 'number-suffix' | 'enum' | 'bool';
  enumValues?: string[];
}

export const BRIEF_FIELD_SCHEMAS: Record<string, BriefFieldSchemaEntry[]> = {
  'subreddit-about': [
    {
      key: 'join_status',
      label: 'Join status',
      hint: 'Joined / not_joined (Reddit: button text "Join" = chưa, "Joined"/"Leave" = đã).',
      parse: 'enum',
      enumValues: ['joined', 'not_joined', 'unknown'],
    },
    {
      key: 'karma_in_sub',
      label: 'Karma in sub',
      hint: 'Sub karma của viewer trong subreddit (Reddit hiển thị ở "Mod tools" / sidebar mod section nếu có).',
      parse: 'number',
    },
    {
      key: 'member_role',
      label: 'Member role',
      hint: 'Role của viewer: mod (xanh shield) / contributor (approved) / member (default).',
      parse: 'enum',
      enumValues: ['mod', 'contributor', 'member', ''],
    },
    {
      key: 'last_visited_at',
      label: 'Last visited',
      hint: 'Lần cuối viewer ghé sub (Reddit có "last visited X days ago" trong một số subs).',
      parse: 'date',
    },
  ],
  // Future: fb-group-membership, discord-server-membership, ...
};

/** Field name dùng trong selector_overrides — có prefix để phân biệt với
 *  habitat fields. Vd schema key "join_status" → selector_overrides field
 *  "brief.join_status". */
export function briefSelectorFieldName(key: string): string {
  return `brief.${key}`;
}

/** Inverse — extract schema key từ selector_overrides field_name. */
export function parseBriefFieldName(name: string): string | null {
  return name.startsWith('brief.') ? name.slice('brief.'.length) : null;
}

export function getBriefFieldSchema(pageKind: string): BriefFieldSchemaEntry[] {
  return BRIEF_FIELD_SCHEMAS[pageKind] ?? [];
}
