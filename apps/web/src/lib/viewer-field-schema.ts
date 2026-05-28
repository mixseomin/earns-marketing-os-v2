// Viewer field schema — declare fields ext scrape về viewer login state
// (per-platform globally, không phụ thuộc habitat cụ thể).
//
// Khác brief.* (per-habitat-per-account) ở chỗ:
//   - viewer.* gắn với platform (Reddit login = login mọi sub)
//   - selector_overrides.scope_kind='platform', scope_key=platformKey
//   - page_kind='platform-any' (selector dùng cho bất kỳ page nào của platform)
//
// Reuse selector_overrides + learn-selectors / save-selector / train-selector
// pipeline. Field name prefix "viewer." để phân biệt với habitat/brief fields.

export interface ViewerFieldSchemaEntry {
  /** Field key trong viewer status (KHÔNG có prefix "viewer."). */
  key: string;
  /** Hiển thị UI + LLM prompt. */
  label: string;
  /** Mô tả LLM dùng để discover + UI tooltip. */
  hint: string;
  /** Parse hint. */
  parse?: 'bool' | 'text' | 'enum';
  enumValues?: string[];
}

export const VIEWER_FIELD_SCHEMAS: Record<string, ViewerFieldSchemaEntry[]> = {
  'platform-any': [
    {
      key: 'logged_in',
      label: 'Logged in',
      hint: 'Selector match element CHỈ tồn tại khi đã login (avatar dropdown, settings link, profile button). Element tồn tại → loggedIn=true. parse=bool (existence check).',
      parse: 'bool',
    },
    {
      key: 'handle',
      label: 'Viewer handle',
      hint: 'Selector trỏ tới element chứa username viewer logged-in. Ext extract qua href (regex /@?([A-Za-z0-9_]+)/) hoặc textContent. KHÔNG match handle của OP/post author.',
      parse: 'text',
    },
  ],
};

export function viewerSelectorFieldName(key: string): string {
  return `viewer.${key}`;
}

export function parseViewerFieldName(name: string): string | null {
  return name.startsWith('viewer.') ? name.slice('viewer.'.length) : null;
}

export function getViewerFieldSchema(pageKind: string = 'platform-any'): ViewerFieldSchemaEntry[] {
  return VIEWER_FIELD_SCHEMAS[pageKind] ?? [];
}
