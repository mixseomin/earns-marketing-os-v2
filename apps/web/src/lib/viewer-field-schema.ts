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
  parse?: 'bool' | 'text' | 'enum' | 'number' | 'date';
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
  // Account-level profile stats — scrape KHI viewer xem profile CỦA CHÍNH MÌNH
  // (account_handle == viewer handle). Lưu vào platform_accounts.account_stats (jsonb).
  // page_kind='account-profile', scope='platform'. Field key = stat name (karma/created/…).
  'account-profile': [
    {
      key: 'account_handle',
      label: 'Profile owner handle',
      hint: 'Handle của CHỦ trang profile đang xem — để xác nhận đúng profile của viewer (chỉ lưu stats khi khớp). Vd HN: //td[="user:"]/following-sibling::td//a[hnuser].',
      parse: 'text',
    },
    {
      key: 'karma',
      label: 'Karma / reputation',
      hint: 'Điểm karma / reputation của account (số). Vd HN: //td[="karma:"]/following-sibling::td. parse=number.',
      parse: 'number',
    },
    {
      key: 'created',
      label: 'Account created (age)',
      hint: 'Ngày tạo account (tuổi account). Chuỗi ngày, vd "September 8, 2011". parse=text/date.',
      parse: 'text',
    },
    {
      key: 'followers',
      label: 'Followers',
      hint: 'Số follower của account (nếu platform có). parse=number.',
      parse: 'number',
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
