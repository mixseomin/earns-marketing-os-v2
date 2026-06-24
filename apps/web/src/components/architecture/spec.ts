// Architecture Studio — system model spec (source of truth for TYPES).
// Each attribute points at a real DB column (`col`) so instance-binding can
// pull live values and consistency-checks can validate. This file documents
// HOW MOS2 is wired; keep it in sync with packages/db/src/schema.ts.

export type ObjGroup = 'platform' | 'identity' | 'place' | 'content' | 'scene' | 'infra' | 'resource';

export interface GroupDef {
  key: ObjGroup;
  label: string;
  color: string; // accent for the group lane / node border
}

export const GROUPS: GroupDef[] = [
  { key: 'platform', label: 'Platform layer', color: '#5badff' },
  { key: 'identity', label: 'Identity layer', color: '#b48cff' },
  { key: 'place', label: 'Place layer', color: '#3ce0c0' },
  { key: 'content', label: 'Content layer', color: '#ffb03c' },
  { key: 'scene', label: 'Scene layer (WHO-THEM)', color: '#ff7ab0' },
  { key: 'infra', label: 'Infra / detection', color: '#8a92a3' },
  { key: 'resource', label: 'Resource layer', color: '#c9a46a' },
];

export type RelKind = 'fk' | 'brief' | 'tracking' | 'm2m' | 'scope' | 'gen' | 'ref';

export interface ObjAttr {
  name: string;          // display name
  col?: string;          // real DB column (snake_case) — enables instance binding
  type: string;          // text | bigint | jsonb | bool | fk | ...
  pk?: boolean;
  fk?: string;           // target object key when this attr is a foreign key
  note?: string;
}

export interface ObjRelation {
  to: string;            // target object key
  kind: RelKind;
  via?: string;          // column / mechanism
  note?: string;
}

export interface ArchObject {
  key: string;
  label: string;
  group: ObjGroup;
  table: string | null;  // real DB table (snake_case); null = doc-only (no instance binding)
  pk?: string;           // PK column (default 'id')
  labelCol?: string;     // column used as instance label in the picker
  projectScoped?: boolean;
  desc: string;
  attrs: ObjAttr[];
  relations: ObjRelation[];
  routes: string[];      // /api/ext/* routes that read/write this object
  deepLink?: string;     // app path to manage real instances
  // instance-picker behaviour (a child entity is meaningless without its parent context):
  picker?: {
    crossProject?: boolean;                    // ignore project filter — entity exists independent of project (habitat)
    parent?: { object: string; col: string };  // cascade: pick the parent first, then filter children (channel → habitat)
    join?: string;                             // STATIC sql join (alias `t` = main table) to resolve the context label
    labelExpr?: string;                        // STATIC sql expr for a MEANINGFUL primary label (overrides labelCol — e.g. acct × habitat)
    subExpr?: string;                          // STATIC sql expr for the option's context sub-label
  };
  // extra columns shown in the node's live instance TABLE (beyond label + id). Each is a
  // REAL column on `table`; browseInstances validates against information_schema so a typo
  // just drops the column (never empties the table). kind=link → cell opens that object's drawer.
  // Special col '__projects' (kind=project) resolves projects via `projectsVia` junction.
  browseCols?: { col: string; label: string; kind?: 'time' | 'badge' | 'link' | 'project' | 'unread'; link?: string }[];
  // many-to-many project membership (account ↔ project_accounts). Lets the table show ALL
  // projects an instance belongs to, not just the legacy scalar project_id.
  projectsVia?: { table: string; fkCol: string };
}

// ── Objects ────────────────────────────────────────────────────────────────
export const OBJECTS: ArchObject[] = [
  {
    key: 'platform', label: 'Platform', group: 'platform',
    table: 'platforms', pk: 'key', labelCol: 'label',
    desc: 'Social platform catalog (x/reddit/fb/discord…). First-class rows, not hardcoded. auto_post_supported=false = SUGGEST-ONLY mode (tool soạn + human copy-paste/đăng tay → ban-risk ≈ 0). DB-adapter mặc định cũng noPost=true (suggest) nên platform mới tự an toàn.',
    picker: { subExpr: 't.category' },
    browseCols: [
      { col: 'category', label: 'category' },
      { col: 'priority', label: 'priority' },
      { col: 'auto_post_supported', label: 'auto-post' },                    // false = suggest-only (manual)
      { col: 'technology_key', label: 'engine', kind: 'link', link: 'technology' },
      { col: '__missingSel', label: 'missing selectors' },                  // CORE composer/login fields chưa train (platform + inherited engine scope) → đi cập nhật
      { col: 'region', label: 'region' },
    ],
    attrs: [
      { name: 'key', col: 'key', type: 'text', pk: true, note: "canonical 'twitter' (ext uses 'x')" },
      { name: 'label', col: 'label', type: 'text' },
      { name: 'priority', col: 'priority', type: 'text', note: 'critical|high|medium' },
      { name: 'category', col: 'category', type: 'text' },
      { name: 'region', col: 'region', type: 'text' },
      { name: 'autoPostSupported', col: 'auto_post_supported', type: 'bool' },
      { name: 'technologyKey', col: 'technology_key', type: 'fk', fk: 'technology', note: 'forum technology if applicable' },
    ],
    relations: [
      { to: 'technology', kind: 'fk', via: 'technology_key' },
      { to: 'account', kind: 'fk', via: 'account.platform_key' },
      { to: 'habitat', kind: 'fk', via: 'habitat.platform_key' },
      { to: 'selector', kind: 'scope', via: "scope_kind='platform'" },
    ],
    routes: ['/platforms', '/platform-info', '/platform-fields/{slug}', '/selectors/resolve'],
    deepLink: '/platforms',
  },
  {
    key: 'technology', label: 'Technology (forum)', group: 'platform',
    table: 'platform_technologies', pk: 'key', labelCol: 'label',
    desc: 'Forum engine (xenforo/phpbb/discourse). Cung cấp technology-scope SELECTORS cho NHIỀU page_kind — signup (form đăng ký) · composer (post/reply fields) · post-metrics (tracking: views/score/reply) · account-profile (user fields: handle/karma/created) · subreddit-about · platform-any (viewer). MỌI platform bind vào engine này KẾ THỪA hết (1 template → N forum). Cột signupFields = CHỈ field-set form đăng ký (legacy, vì signup khác nhau theo engine); field các page_kind khác = schema chung trong code + selector theo technology (xem mục SELECTORS bên dưới).',
    attrs: [
      { name: 'key', col: 'key', type: 'text', pk: true },
      { name: 'label', col: 'label', type: 'text' },
      { name: 'description', col: 'description', type: 'text' },
      { name: 'signupFields', col: 'signup_fields', type: 'jsonb' },
    ],
    relations: [
      { to: 'platform', kind: 'fk', via: 'platform.technology_key' },
      { to: 'habitat', kind: 'fk', via: 'habitat.technology_key' },
      { to: 'selector', kind: 'scope', via: "scope_kind='technology'" },
    ],
    routes: ['/technologies', '/selectors/resolve'],
    deepLink: '/technologies',
  },
  {
    key: 'domSample', label: 'DOM Sample', group: 'platform', table: null,
    desc: 'Thư viện HTML thô: ext (browser ĐÃ login) chụp full rendered DOM 1 trang cần track → lưu theo PLATFORM (site) + TECHNOLOGY (engine) + page_kind. Giải login-gated (server không curl được trang cần auth) + giữ mẫu để Claude extract selector/field về sau (giờ lấy username, sau lấy posts list…). KHÔNG phải runtime — chỉ là NGUỒN để train selector. Mỗi sample luôn gắn 1 site/engine cụ thể.',
    attrs: [
      { name: 'id', type: 'bigserial', pk: true },
      { name: 'platformKey', col: 'platform_key', type: 'text' },
      { name: 'technologyKey', col: 'technology_key', type: 'text' },
      { name: 'pageKind', col: 'page_kind', type: 'text' },
      { name: 'url', col: 'url', type: 'text' },
      { name: 'bytes', col: 'bytes', type: 'int' },
      { name: 'capturedAt', col: 'captured_at', type: 'timestamptz' },
    ],
    relations: [
      { to: 'platform', kind: 'fk', via: 'dom_samples.platform_key' },
      { to: 'technology', kind: 'fk', via: 'dom_samples.technology_key' },
      { to: 'selector', kind: 'ref', via: 'extract → selector_overrides' },
    ],
    routes: ['/dom-sample'],
  },
  {
    key: 'generator', label: 'Generator (gen/QA)', group: 'infra',
    table: 'generators', pk: 'key', labelCol: 'label',
    desc: 'Content/QA generator (Astrolas, HyperJournal). External endpoint per project capability.',
    attrs: [
      { name: 'key', col: 'key', type: 'text', pk: true },
      { name: 'label', col: 'label', type: 'text' },
      { name: 'endpoint', col: 'endpoint', type: 'text' },
      { name: 'defaultModel', col: 'default_model', type: 'text' },
      { name: 'enabled', col: 'enabled', type: 'bool' },
    ],
    relations: [
      { to: 'card', kind: 'gen', via: "card.answer_source" },
      { to: 'externalApi', kind: 'gen', via: 'endpoint' },
    ],
    routes: ['/technologies', '/seeding/astrolas-answer', '/seeding/hyperjournal-answer', '/astrolas/models'],
    deepLink: '/technologies',
  },
  {
    key: 'account', label: 'Account', group: 'identity',
    table: 'platform_accounts', pk: 'id', labelCol: 'handle', projectScoped: false,
    desc: 'Owned social account = (platform, handle). Belongs to MANY projects via project_accounts (project_id is legacy owner only). May be based on an identity — optional, not fixed. Pick by PLATFORM.',
    picker: { parent: { object: 'platform', col: 'platform_key' }, subExpr: 't.status' },
    projectsVia: { table: 'project_accounts', fkCol: 'account_id' },
    browseCols: [
      { col: 'platform_key', label: 'platform', kind: 'link', link: 'platform' },
      { col: '__projects', label: 'project', kind: 'project' },
      { col: 'email', label: 'email' },
      { col: 'status', label: 'status', kind: 'badge' },
      { col: '__unread', label: '✉', kind: 'unread' },
      { col: 'created_at', label: 'created', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'projectId', col: 'project_id', type: 'fk', note: 'legacy owner; multi-brand via project_accounts' },
      { name: 'platformKey', col: 'platform_key', type: 'fk', fk: 'platform' },
      { name: 'handle', col: 'handle', type: 'text' },
      { name: 'status', col: 'status', type: 'text', note: 'todo→creating→warming→active; limited/blocked/banned' },
      { name: 'accountKind', col: 'account_kind', type: 'text', note: 'user|bot|app' },
      { name: 'persona', col: 'persona', type: 'jsonb', note: 'dob/gender/country/replyStyle…' },
      { name: 'proxyId', col: 'proxy_id', type: 'fk' },
      { name: 'ownerUserId', col: 'owner_user_id', type: 'fk' },
    ],
    relations: [
      { to: 'platform', kind: 'fk', via: 'platform_key' },
      { to: 'identity', kind: 'ref', via: 'persona.identityId (optional, not fixed)' },
      { to: 'brief', kind: 'brief', via: 'community_briefs.account_id' },
      { to: 'card', kind: 'fk', via: 'card.account_id' },
      { to: 'interaction', kind: 'tracking', via: 'interactions.account_id' },
    ],
    routes: ['/accounts', '/accounts/profile', '/accounts/{id}', '/accounts/map', '/scene/interact'],
  },
  {
    key: 'identity', label: 'Identity (signup)', group: 'identity',
    table: 'identities', pk: 'id', labelCol: 'name', projectScoped: true,
    desc: 'Reusable signup identity preset (persona template), defined per project. An account MAY be based on one — optional, not fixed.',
    picker: { subExpr: 't.kind' },
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'projectId', col: 'project_id', type: 'fk' },
      { name: 'name', col: 'name', type: 'text' },
      { name: 'kind', col: 'kind', type: 'text' },
      { name: 'handleBase', col: 'handle_base', type: 'text' },
      { name: 'email', col: 'email', type: 'text' },
    ],
    relations: [
      { to: 'account', kind: 'ref', via: 'account.persona.identityId (optional)' },
      { to: 'project', kind: 'fk', via: 'identities.project_id' },
    ],
    routes: ['/identities', '/identities/{id}', '/identities/generate'],
  },
  {
    key: 'project', label: 'Project', group: 'identity',
    table: 'projects', pk: 'id', labelCol: 'name', projectScoped: false,
    desc: 'Brand/project container — top-level scope. Mọi identity/account/habitat/brief thuộc 1 project. Bước ĐẦU của flow đăng ký = chọn project.',
    picker: { subExpr: 't.one_liner' },
    attrs: [
      { name: 'id', col: 'id', type: 'text', pk: true },
      { name: 'name', col: 'name', type: 'text' },
      { name: 'emoji', col: 'emoji', type: 'text' },
      { name: 'oneLiner', col: 'one_liner', type: 'text' },
      { name: 'website', col: 'website', type: 'text' },
      { name: 'persona', col: 'persona', type: 'jsonb', note: 'brand voice → AI gen identity' },
    ],
    relations: [
      { to: 'identity', kind: 'fk', via: 'identities.project_id' },
      { to: 'account', kind: 'fk', via: 'account.project_id / project_accounts' },
      { to: 'habitat', kind: 'fk', via: 'habitats.project_id' },
    ],
    routes: ['/projects', '/p/{id}'],
    deepLink: '/projects',
  },
  {
    key: 'profileOnsite', label: 'Profile (on-site)', group: 'identity', table: null,
    desc: 'KHÔNG phải entity lưu riêng — là VIEW dẫn xuất của Account. Account = bản ghi đăng nhập (credential + status, có thật trong platform_accounts). Profile (on-site) = "mặt hiển thị" của account đó trên trang profile = chiếu account.persona + identity.custom_fields LÊN site qua selectors page_kind=account-profile. Cùng data, khác VAI TRÒ: Account trả lời "đăng nhập được? handle/status?", Profile trả lời "trang hồ sơ hiện gì?". Doc-only vì không lưu tách khỏi account.',
    attrs: [
      { name: 'displayName', type: 'text', note: 'account.persona.display_name' },
      { name: 'bio', type: 'text', note: 'account.persona.bio / identity.bio' },
      { name: 'avatar', type: 'text', note: 'identity.avatar_url' },
      { name: 'customFields', type: 'jsonb', note: 'identity.custom_fields (pronoun/dob/…) → reuse mọi site' },
    ],
    relations: [
      { to: 'account', kind: 'ref', via: 'IS-A view of account (account.persona = nơi lưu thật)' },
      { to: 'identity', kind: 'ref', via: 'identity.custom_fields / bio / avatar (nguồn canonical)' },
      { to: 'selector', kind: 'scope', via: "page_kind='account-profile' (cách chiếu lên trang)" },
    ],
    routes: ['/profile-fields/suggest', '/accounts/{id}', '/selectors/resolve'],
  },
  {
    key: 'browserProfile', label: 'Browser profile', group: 'infra',
    table: 'browser_profiles', pk: 'id', labelCol: 'label', projectScoped: false,
    desc: 'Anti-detect browser profile (fingerprint/UA/proxy) để chạy account an toàn. Gán cho account khi tạo/login.',
    picker: { subExpr: 't.tool' },
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'label', col: 'label', type: 'text' },
      { name: 'tool', col: 'tool', type: 'text', note: 'gologin/ads/dolphin…' },
      { name: 'userAgent', col: 'user_agent', type: 'text' },
      { name: 'fingerprint', col: 'fingerprint', type: 'jsonb' },
      { name: 'defaultProxyId', col: 'default_proxy_id', type: 'fk' },
    ],
    relations: [
      { to: 'account', kind: 'ref', via: 'account ↔ browser_profile (assign)' },
    ],
    routes: ['/browser-profiles'],
  },
  {
    key: 'uxFlow', label: 'UX Flows (need→action)', group: 'infra',
    table: 'ux_flows', pk: 'id', labelCol: 'label', projectScoped: false,
    desc: 'Danh sách flow UI/UX = chuỗi nhu cầu→hành động (sơ đồ khối). Mỗi step link entity nó chạm → mở drawer. Data-driven (ux_flows/ux_flow_steps) → scale + sửa trong Studio. Drive thiết kế ext.',
    picker: { subExpr: 't.surface' },
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'key', col: 'key', type: 'text' },
      { name: 'label', col: 'label', type: 'text' },
      { name: 'surface', col: 'surface', type: 'text', note: 'ext-register / ext-seed…' },
    ],
    relations: [
      { to: 'project', kind: 'ref', via: 'step.objects' },
      { to: 'identity', kind: 'ref', via: 'step.objects' },
      { to: 'selector', kind: 'ref', via: 'step.objects' },
    ],
    routes: ['/ux-flows', '/ux-flows/{id}'],
  },
  {
    key: 'habitat', label: 'Habitat', group: 'place',
    table: 'habitats', pk: 'id', labelCol: 'name', projectScoped: true,
    desc: 'A community the operator works in (subreddit/fb-group/discord/forum). Links platform+technology+tribe.',
    picker: { crossProject: true, subExpr: 't.project_id' },
    browseCols: [
      { col: 'platform_key', label: 'platform', kind: 'link', link: 'platform' },
      { col: 'project_id', label: 'project', kind: 'project' },
      { col: 'community_type', label: 'type' },
      { col: 'status', label: 'status', kind: 'badge' },
      { col: 'created_at', label: 'created', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'projectId', col: 'project_id', type: 'fk' },
      { name: 'kind', col: 'kind', type: 'text', note: 'subreddit|fb-group|discord|forum|hashtag' },
      { name: 'name', col: 'name', type: 'text' },
      { name: 'url', col: 'url', type: 'text' },
      { name: 'platformKey', col: 'platform_key', type: 'fk', fk: 'platform' },
      { name: 'technologyKey', col: 'technology_key', type: 'fk', fk: 'technology' },
      { name: 'tribeId', col: 'tribe_id', type: 'fk' },
      { name: 'status', col: 'status', type: 'text', note: 'target|engaged|saturated|banned|dormant' },
      { name: 'voiceProfile', col: 'voice_profile', type: 'text' },
    ],
    relations: [
      { to: 'platform', kind: 'fk', via: 'platform_key' },
      { to: 'technology', kind: 'fk', via: 'technology_key' },
      { to: 'channel', kind: 'fk', via: 'habitat_channels.habitat_id' },
      { to: 'brief', kind: 'brief', via: 'community_briefs.habitat_id' },
      { to: 'card', kind: 'fk', via: 'card.habitat_id' },
      { to: 'people', kind: 'fk', via: 'people.habitat_id' },
      { to: 'selector', kind: 'scope', via: "scope_kind='habitat'" },
    ],
    routes: ['/habitats', '/habitats/resolve', '/habitats/list', '/habitats/channels'],
  },
  {
    key: 'channel', label: 'Channel', group: 'place',
    table: 'habitat_channels', pk: 'id', labelCol: 'name', projectScoped: false,
    desc: 'Sub-channel/board inside a habitat (Discord channel, forum board, Slack channel) = chỗ ĐĂNG bài (post-target grain). Platform kế thừa từ habitat; board_id → platform_boards catalog.',
    picker: { parent: { object: 'habitat', col: 'habitat_id' }, join: 'LEFT JOIN habitats h ON h.id = t.habitat_id', labelExpr: "concat(coalesce(h.name,'?'),' / ',t.name)" },
    browseCols: [
      { col: '__platform', label: 'platform', kind: 'link', link: 'platform' },
      { col: 'name', label: 'name' },
      { col: 'board_id', label: 'board', kind: 'link', link: 'board' },
      { col: 'language', label: 'lang' },
      { col: 'created_at', label: 'created', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'habitatId', col: 'habitat_id', type: 'fk', fk: 'habitat', note: 'platform kế thừa từ habitat này' },
      { name: 'name', col: 'name', type: 'text' },
      { name: 'url', col: 'url', type: 'text' },
      { name: 'description', col: 'description', type: 'text' },
      { name: 'topic', col: 'topic', type: 'text', note: 'platform topic field (Discord/Slack)' },
      { name: 'language', col: 'language', type: 'text', note: 'channel-level lang override' },
      { name: 'externalId', col: 'external_id', type: 'text', note: 'Discord snowflake / Slack channel id' },
      { name: 'boardId', col: 'board_id', type: 'fk', fk: 'board', note: 'post-target board trong catalog (Seeding Radar)' },
      { name: 'sortOrder', col: 'sort_order', type: 'integer' },
    ],
    relations: [
      { to: 'platform', kind: 'fk', via: 'habitats.platform_key' },
      { to: 'habitat', kind: 'fk', via: 'habitat_id' },
      { to: 'card', kind: 'fk', via: 'card.channel_id' },
      { to: 'board', kind: 'fk', via: 'board_id' },
    ],
    routes: ['/habitats/channels', '/habitats/channel-info', '/channels/posts'],
  },
  {
    key: 'board', label: 'Board (catalog)', group: 'place',
    table: 'platform_boards', pk: 'id', labelCol: 'name', projectScoped: false,
    desc: 'SHARED platform board catalog (subreddit / forum subforum / Discord channel). 1 row per real board, reused across MỌI project. Adopted by habitats (board_id, community-grain) + channels (board_id, post-target). Seeding Radar Layer 1. Score per project ở board_project_score.',
    picker: { subExpr: 't.platform_key' },
    browseCols: [
      { col: 'platform_key', label: 'platform', kind: 'link', link: 'platform' },
      { col: 'technology_key', label: 'engine', kind: 'link', link: 'technology' },
      { col: 'name', label: 'name' },
      { col: 'members', label: 'members' },
      { col: 'language', label: 'lang' },
      { col: 'url', label: 'url' },
      { col: 'last_seen_at', label: 'seen', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'platformKey', col: 'platform_key', type: 'fk', fk: 'platform', note: 'mọi board kèm 1 platform; forum = engine ở technology_key' },
      { name: 'technologyKey', col: 'technology_key', type: 'fk', fk: 'technology', note: 'phpbb|xenforo|discourse… (platform của forum)' },
      { name: 'externalId', col: 'external_id', type: 'text', note: 'engine-aware identity: subreddit slug / guild_id / forum f=N (NOT name)' },
      { name: 'name', col: 'name', type: 'text', note: 'display fallback only' },
      { name: 'url', col: 'url', type: 'text' },
      { name: 'parentBoardId', col: 'parent_board_id', type: 'fk', fk: 'board', note: 'community↔post-target hierarchy' },
      { name: 'members', col: 'members', type: 'integer' },
      { name: 'privacy', col: 'privacy', type: 'text', note: 'public|restricted|private' },
      { name: 'description', col: 'description', type: 'text', note: 'tự đọc từ page (Seeding Radar)' },
      { name: 'dominantTopics', col: 'dominant_topics', type: 'jsonb', note: 'chủ đề board — tín hiệu fit mạnh nhất' },
      { name: 'forbiddenTopics', col: 'forbidden_topics', type: 'jsonb', note: 'chủ đề né (hard-exclude)' },
      { name: 'language', col: 'language', type: 'text' },
    ],
    relations: [
      { to: 'platform', kind: 'fk', via: 'platform_key' },
      { to: 'technology', kind: 'fk', via: 'technology_key' },
      { to: 'habitat', kind: 'fk', via: 'habitats.board_id' },
      { to: 'channel', kind: 'fk', via: 'habitat_channels.board_id' },
      { to: 'board', kind: 'fk', via: 'parent_board_id' },
    ],
    routes: ['/boards/badge', '/boards/ensure', '/boards/score', '/boards/ensure-then-brief'],
  },
  {
    key: 'boardScore', label: 'Board score (per project)', group: 'place',
    table: 'board_project_score', pk: 'id', labelCol: 'fit', projectScoped: true,
    desc: 'Seeding Radar Layer 2 — topic-fit score của 1 board cho 1 project (account-FREE). fit 0-100 + topic_tier + approach (angle bắc cầu) + approach_playbook_id (nguồn thư viện) + manual_tier (SKIP/GO override). Ghi bởi ext khi chấm board. Aggregate funnel/backlog/coverage xem ở seeding cockpit view "📡 Radar" (/p/<id>/seeding?st=radar).',
    picker: { subExpr: "concat('fit ', t.fit)" },
    browseCols: [
      { col: 'project_id', label: 'project', kind: 'link', link: 'project' },
      { col: '__board', label: 'board' },                                    // tên board · platform (readable)
      { col: 'board_id', label: '#', kind: 'link', link: 'board' },          // link drill xuống board
      { col: 'topic_tier', label: 'tier' },
      { col: 'manual_tier', label: 'manual' },
      { col: 'approach_playbook_id', label: 'playbook', kind: 'link', link: 'approach' },
      { col: 'stale', label: 'stale' },
      { col: 'scored_at', label: 'scored', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'boardId', col: 'board_id', type: 'fk', fk: 'board' },
      { name: 'projectId', col: 'project_id', type: 'fk', fk: 'project' },
      { name: 'fit', col: 'fit', type: 'integer', note: '0-100 topic fit ONLY (account-free)' },
      { name: 'topicTier', col: 'topic_tier', type: 'text', note: 'TRACK-threshold tier' },
      { name: 'reason', col: 'reason', type: 'text', note: 'scoring rationale (audit)' },
      { name: 'approach', col: 'approach', type: 'text', note: 'angle bắc cầu khi board lệch topic → re-score cao hơn' },
      { name: 'approachPlaybookId', col: 'approach_playbook_id', type: 'fk', fk: 'approach', note: 'nguồn nếu lấy từ thư viện' },
      { name: 'manualTier', col: 'manual_tier', type: 'text', note: 'SKIP(dismiss) | GO(pin) | null(auto-compose)' },
      { name: 'stale', col: 'stale', type: 'boolean', note: 'đổi pillar/signal → set stale → re-score' },
    ],
    relations: [
      { to: 'board', kind: 'fk', via: 'board_id' },
      { to: 'project', kind: 'fk', via: 'project_id' },
      { to: 'approach', kind: 'fk', via: 'approach_playbook_id' },
    ],
    routes: ['/boards/score', '/boards/approach', '/boards/badge'],
  },
  {
    key: 'approach', label: 'Approach playbook', group: 'content',
    table: 'approach_playbooks', pk: 'id', labelCol: 'title', projectScoped: false,
    desc: 'SHARED cross-project library of seeding approach angles (vd "dùng astrology phân tích người nổi tiếng được bàn ở board"). Reusable knowledge — chọn áp dụng cho board bất kỳ ở project bất kỳ. Áp vào board×project → ghi board_project_score.approach (angle) + approach_playbook_id (link) + bump uses.',
    picker: { subExpr: 't.platform_key' },
    browseCols: [
      { col: 'title', label: 'title' },
      { col: 'platform_key', label: 'platform', kind: 'link', link: 'platform' },
      { col: 'uses', label: 'uses' },
      { col: 'updated_at', label: 'updated', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'title', col: 'title', type: 'text' },
      { name: 'angle', col: 'angle', type: 'text', note: 'nội dung approach (cái /boards/score chấm theo)' },
      { name: 'category', col: 'category', type: 'text' },
      { name: 'sourceProjectId', col: 'source_project_id', type: 'fk', note: 'project tác giả (reusable mọi project)' },
      { name: 'platformKey', col: 'platform_key', type: 'fk', fk: 'platform', note: 'null = any platform' },
      { name: 'uses', col: 'uses', type: 'integer', note: 'số lần áp vào board (độ phổ biến)' },
    ],
    relations: [
      { to: 'platform', kind: 'fk', via: 'platform_key' },
    ],
    routes: ['/approaches', '/boards/approach'],
  },
  {
    key: 'brief', label: 'Brief (acc×habitat)', group: 'content',
    table: 'community_briefs', pk: 'id', labelCol: 'id', projectScoped: true,
    desc: 'THE link between account + habitat: strategy/voice/phase. Drives every AI draft.',
    picker: { join: 'LEFT JOIN platform_accounts a ON a.id = t.account_id LEFT JOIN habitats h ON h.id = t.habitat_id', labelExpr: "concat(coalesce(a.handle,'?'),' × ',coalesce(h.name,'?'))", subExpr: 't.current_phase' },
    browseCols: [
      { col: 'project_id', label: 'project', kind: 'project' },
      { col: 'current_phase', label: 'phase', kind: 'badge' },
      { col: 'join_status', label: 'join' },
      { col: 'created_at', label: 'created', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'projectId', col: 'project_id', type: 'fk' },
      { name: 'accountId', col: 'account_id', type: 'fk', fk: 'account' },
      { name: 'habitatId', col: 'habitat_id', type: 'fk', fk: 'habitat' },
      { name: 'tone', col: 'tone', type: 'text' },
      { name: 'currentPhase', col: 'current_phase', type: 'text', note: 'warm-up|value|bridge|seed|direct|cooldown' },
      { name: 'joinStatus', col: 'join_status', type: 'text' },
      { name: 'primaryPillarId', col: 'primary_pillar_id', type: 'fk', fk: 'pillar' },
    ],
    relations: [
      { to: 'account', kind: 'brief', via: 'account_id' },
      { to: 'habitat', kind: 'brief', via: 'habitat_id' },
      { to: 'pillar', kind: 'fk', via: 'primary_pillar_id' },
      { to: 'card', kind: 'fk', via: 'card.brief_id' },
    ],
    routes: ['/brief/get', '/brief/update', '/briefs', '/seeding/quick-comment'],
  },
  {
    key: 'pillar', label: 'Content pillar', group: 'content',
    table: 'content_pillars', pk: 'id', labelCol: 'name', projectScoped: true,
    desc: 'Macro content theme/positioning + relevance signals (key_messages/seo_keywords/forbidden_msgs/languages) mà Seeding Radar chấm board theo. SỬA tại /p/<id>/pillars (Studio map read-only).',
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'projectId', col: 'project_id', type: 'fk' },
      { name: 'name', col: 'name', type: 'text' },
      { name: 'voiceProfile', col: 'voice_profile', type: 'text' },
      { name: 'externalTag', col: 'external_tag', type: 'text' },
      { name: 'keyMessages', col: 'key_messages', type: 'jsonb', note: 'bán/nói về gì — tín hiệu fit "② Project cần gì"' },
      { name: 'seoKeywords', col: 'seo_keywords', type: 'jsonb', note: 'keywords chấm relevance' },
      { name: 'forbiddenMsgs', col: 'forbidden_msgs', type: 'jsonb', note: 'tránh — hard-exclude khi board trùng' },
      { name: 'languages', col: 'languages', type: 'jsonb' },
    ],
    relations: [
      { to: 'project', kind: 'fk', via: 'project_id' },
      { to: 'brief', kind: 'fk', via: 'brief.primary_pillar_id' },
      { to: 'card', kind: 'fk', via: 'card.pillar_id' },
    ],
    routes: ['/pillars', '/pillars/suggest'],
  },
  {
    key: 'card', label: 'Card (content)', group: 'content',
    table: 'cards', pk: 'id', labelCol: 'card_ref', projectScoped: true,
    desc: 'Content unit through full lifecycle: draft → posted → insights. Identity via brief OR direct account/habitat.',
    picker: { join: 'LEFT JOIN habitats h ON h.id = t.habitat_id', labelExpr: "t.card_ref || coalesce(' · ' || nullif(left(coalesce(t.title_review, t.title, ''), 26), ''), '')", subExpr: 'h.name' },
    browseCols: [
      { col: 'project_id', label: 'project', kind: 'project' },
      { col: 'content_type', label: 'type' },
      { col: 'post_lifecycle', label: 'lifecycle', kind: 'badge' },
      { col: 'created_at', label: 'created', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'projectId', col: 'project_id', type: 'fk' },
      { name: 'cardRef', col: 'card_ref', type: 'text' },
      { name: 'col', col: 'col', type: 'text', note: 'kanban column' },
      { name: 'contentType', col: 'content_type', type: 'text' },
      { name: 'contentKind', col: 'content_kind', type: 'text', note: 'seed|blog|email|thread' },
      { name: 'briefId', col: 'brief_id', type: 'fk', fk: 'brief', note: 'identity path A' },
      { name: 'accountId', col: 'account_id', type: 'fk', fk: 'account', note: 'identity path B (direct)' },
      { name: 'habitatId', col: 'habitat_id', type: 'fk', fk: 'habitat', note: 'identity path B (direct)' },
      { name: 'pillarId', col: 'pillar_id', type: 'fk', fk: 'pillar' },
      { name: 'postUrl', col: 'post_url', type: 'text' },
      { name: 'postLifecycle', col: 'post_lifecycle', type: 'text', note: 'live|removed|… (= badge "live")' },
      { name: 'briefPhase', col: 'brief_phase', type: 'text', note: 'lifecycle phase (= badge "warm-up")' },
      { name: 'postedAt', col: 'posted_at', type: 'date' },
      { name: 'answerSource', col: 'answer_source', type: 'text', note: 'astrolas|hyperjournal' },
      // tracking — on-page engagement scraped back into the card (the ↑ 💬 badge)
      { name: 'insightsScore', col: 'insights_score', type: 'int', note: '↑ upvotes / score' },
      { name: 'insightsReplyCount', col: 'insights_reply_count', type: 'int', note: '💬 replies' },
      { name: 'insightsUpvoteRatio', col: 'insights_upvote_ratio', type: 'float' },
      { name: 'insightsViews', col: 'insights_views_count', type: 'int' },
      { name: 'insightsEngagements', col: 'insights_engagements', type: 'int' },
      { name: 'insightsFetchedAt', col: 'insights_fetched_at', type: 'date', note: 'last tracked' },
    ],
    relations: [
      { to: 'brief', kind: 'fk', via: 'brief_id' },
      { to: 'account', kind: 'fk', via: 'account_id' },
      { to: 'habitat', kind: 'fk', via: 'habitat_id' },
      { to: 'pillar', kind: 'fk', via: 'pillar_id' },
      { to: 'interaction', kind: 'tracking', via: 'interactions.card_id' },
      { to: 'generator', kind: 'gen', via: 'answer_source' },
    ],
    routes: ['/seeding/quick-comment', '/seeding/mark-posted', '/seeding/insights', '/seeding/list-drafts'],
  },
  {
    key: 'knowledge', label: 'Knowledge', group: 'resource',
    table: 'knowledge_items', pk: 'id', labelCol: 'title', projectScoped: true,
    desc: 'Resource / Knowledge vault — playbook · prompt · template · lesson · gotcha tái dùng. project_id null = portfolio-wide, có project = riêng project đó. Nguồn context cho agent + trang /resources. Vd: militarycalc widget-embed outreach playbook (kind=playbook). KHÔNG nhầm với Card (content_pieces = bài đăng/draft kênh); Knowledge = tri thức/quy trình tái dùng, không phải nội dung để post.',
    picker: { subExpr: 't.kind' },
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'title', col: 'title', type: 'text' },
      { name: 'kind', col: 'kind', type: 'text', note: 'playbook|prompt|template|lesson|gotcha' },
      { name: 'content', col: 'content', type: 'text', note: 'markdown body' },
      { name: 'tags', col: 'tags', type: 'jsonb' },
      { name: 'projectId', col: 'project_id', type: 'fk', fk: 'project', note: 'null = portfolio-wide' },
      { name: 'importedFrom', col: 'imported_from', type: 'text', note: 'agent_run / chat / wiki origin' },
    ],
    relations: [
      { to: 'project', kind: 'fk', via: 'project_id (null = portfolio-wide)' },
    ],
    routes: [],
    deepLink: '/p/{id}/resources',
    browseCols: [
      { col: 'kind', label: 'kind', kind: 'badge' },
      { col: 'updated_at', label: 'updated', kind: 'time' },
    ],
  },
  {
    key: 'people', label: 'People (scene)', group: 'scene',
    table: 'people', pk: 'id', labelCol: 'handle', projectScoped: true,
    desc: 'WHO-THEM: a person the operator interacts with. Familiarity score + status.',
    picker: { join: 'LEFT JOIN habitats h ON h.id = t.habitat_id', subExpr: 'h.name' },
    browseCols: [
      { col: 'platform_key', label: 'platform', kind: 'link', link: 'platform' },
      { col: 'project_id', label: 'project', kind: 'project' },
      { col: 'display_name', label: 'name' },
      { col: 'status', label: 'status', kind: 'badge' },
      { col: 'created_at', label: 'created', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'projectId', col: 'project_id', type: 'fk' },
      { name: 'platformKey', col: 'platform_key', type: 'fk', fk: 'platform', note: "canonical 'twitter'" },
      { name: 'handle', col: 'handle', type: 'text' },
      { name: 'habitatId', col: 'habitat_id', type: 'fk', fk: 'habitat' },
      { name: 'familiarityScore', col: 'familiarity_score', type: 'int', note: '0-100' },
      { name: 'interactionCount', col: 'interaction_count', type: 'int' },
      { name: 'theyRepliedBack', col: 'they_replied_back', type: 'bool' },
      { name: 'status', col: 'status', type: 'text', note: 'observed|engaging|warm|bridged|ignore' },
    ],
    relations: [
      { to: 'platform', kind: 'fk', via: 'platform_key' },
      { to: 'habitat', kind: 'fk', via: 'habitat_id' },
      { to: 'interaction', kind: 'tracking', via: 'interactions.people_id' },
    ],
    routes: ['/scene/people', '/scene/observe', '/scene/interact', '/scene/lookup'],
  },
  {
    key: 'interaction', label: 'Interaction (tracking)', group: 'scene',
    table: 'interactions', pk: 'id', labelCol: 'kind', projectScoped: false,
    desc: 'THE tracking link: one engagement event between us (account/card) and a person.',
    picker: { join: 'LEFT JOIN people pe ON pe.id = t.people_id LEFT JOIN platform_accounts a ON a.id = t.account_id', labelExpr: "concat(coalesce(pe.handle,'?'),' × ',coalesce(a.handle,'me'))", subExpr: "concat(t.kind,' · ',t.direction)" },
    browseCols: [
      { col: 'kind', label: 'kind', kind: 'badge' },
      { col: 'direction', label: 'dir' },
      { col: 'at', label: 'at', kind: 'time' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'peopleId', col: 'people_id', type: 'fk', fk: 'people' },
      { name: 'cardId', col: 'card_id', type: 'fk', fk: 'card' },
      { name: 'accountId', col: 'account_id', type: 'fk', fk: 'account' },
      { name: 'kind', col: 'kind', type: 'text', note: 'reply|quote|mention|like' },
      { name: 'direction', col: 'direction', type: 'text', note: 'theirs|ours' },
      { name: 'at', col: 'at', type: 'timestamp' },
    ],
    relations: [
      { to: 'people', kind: 'tracking', via: 'people_id' },
      { to: 'card', kind: 'tracking', via: 'card_id' },
      { to: 'account', kind: 'tracking', via: 'account_id' },
    ],
    routes: ['/scene/interact', '/seeding/insights'],
  },
  {
    key: 'selector', label: 'Selector override', group: 'infra',
    table: 'selector_overrides', pk: 'id', labelCol: 'field_name', projectScoped: false,
    desc: 'Selector library row. Cascade habitat > platform > technology. Resolves DOM fields for detection/marking. HEALTH: ext báo kết quả resolve trên trang thật → miss_streak (số lần liên tiếp tìm ko thấy). 0=khỏe, ≥3=flaky, ≥5=hỏng (DOM đổi → retrain). Xem cảnh báo ở System Scan.',
    picker: { subExpr: "concat(t.scope_kind,' · ',t.page_kind)" },
    browseCols: [
      { col: 'scope_key', label: 'scope' },
      { col: 'page_kind', label: 'page' },
      { col: 'miss_streak', label: 'miss⚠', kind: 'badge' },                 // ≥3 flaky, ≥5 broken
      { col: 'last_ok_at', label: 'last ok', kind: 'time' },
      { col: 'source', label: 'src' },
    ],
    attrs: [
      { name: 'id', col: 'id', type: 'bigint', pk: true },
      { name: 'scopeKind', col: 'scope_kind', type: 'text', note: 'technology|platform|habitat (legacy: engine)' },
      { name: 'scopeKey', col: 'scope_key', type: 'text' },
      { name: 'pageKind', col: 'page_kind', type: 'text', note: 'composer|subreddit-about|forum-thread…' },
      { name: 'fieldName', col: 'field_name', type: 'text', note: 'post.author|post.body|post.permalink…' },
      { name: 'spec', col: 'spec', type: 'jsonb', note: '{css,attr?} — NESTED under spec' },
      { name: 'source', col: 'source', type: 'text', note: 'llm|manual|promoted' },
      { name: 'confidence', col: 'confidence', type: 'int' },
      { name: 'missStreak', col: 'miss_streak', type: 'int', note: 'consecutive live-page misses; ≥5 = retrain' },
      { name: 'lastOkAt', col: 'last_ok_at', type: 'timestamp', note: 'last live resolve hit' },
      { name: 'lastMissAt', col: 'last_miss_at', type: 'timestamp' },
      { name: 'lastUrl', col: 'last_url', type: 'text', note: 'URL of last miss (debug)' },
    ],
    relations: [
      { to: 'platform', kind: 'scope', via: "scope_kind='platform'" },
      { to: 'technology', kind: 'scope', via: "scope_kind='technology'" },
      { to: 'habitat', kind: 'scope', via: "scope_kind='habitat'" },
    ],
    routes: ['/selectors/resolve', '/selectors/set', '/learn-selectors', '/train-selector'],
  },
  {
    key: 'externalApi', label: 'External API', group: 'infra',
    table: null,
    desc: 'External integration (no single table — creds in platform_accounts/generators). Doc-only catalogue.',
    attrs: [
      { name: 'Anthropic (Claude)', type: 'integration', note: 'AI gen — ANTHROPIC_API_KEY' },
      { name: 'OpenAI (image)', type: 'integration', note: 'gpt-image-2 media gen' },
      { name: 'Astrolas / HyperJournal', type: 'integration', note: 'generators.endpoint' },
      { name: 'Platform tokens', type: 'integration', note: 'platform_accounts.api_token_enc / bot_token_enc' },
      { name: 'GA4 / GSC / Cloudflare', type: 'integration', note: 'analytics + infra (server cron)' },
    ],
    relations: [
      { to: 'generator', kind: 'gen', via: 'endpoint' },
      { to: 'account', kind: 'gen', via: 'api_token_enc' },
    ],
    routes: ['/ai-post', '/seeding/quick-comment', '/media/generate'],
  },
];

export const OBJ_BY_KEY: Record<string, ArchObject> = Object.fromEntries(OBJECTS.map((o) => [o.key, o]));

// ── Flows ──────────────────────────────────────────────────────────────────
export type FlowFamily = 'onpage' | 'backend';

export interface FlowStep {
  id: string;
  label: string;
  objects: string[];     // object keys touched
  route?: string;
  writes?: string[];     // tables written
  note?: string;
}

export interface ArchFlow {
  key: string;
  family: FlowFamily;
  label: string;
  desc: string;
  steps: FlowStep[];     // rendered left→right, linearly connected
}

export const FLOWS: ArchFlow[] = [
  {
    key: 'onpage', family: 'onpage', label: 'On-page (extension)',
    desc: 'What the Crew extension does as the operator works a platform page.',
    steps: [
      { id: 'detect', label: 'Detect', objects: ['platform', 'technology', 'habitat'], note: 'crew-detector: platform/habitat detect + viewer resolve' },
      { id: 'autosave', label: 'Auto-save', objects: ['habitat', 'brief'], route: 'POST /habitats · /briefs', writes: ['habitats', 'community_briefs'] },
      { id: 'load', label: 'Load state', objects: ['account', 'brief', 'people', 'selector'], route: 'GET /habitats/resolve · /accounts/profile · /scene/people · /selectors/resolve' },
      { id: 'mark', label: 'Mark', objects: ['people', 'card'], route: 'POST /scene/observe', note: 'markTrackedUsers WHO marker (◎ familiarity)' },
      { id: 'reply', label: 'Reply-assist', objects: ['brief', 'account', 'card', 'externalApi'], route: 'POST /seeding/quick-comment', writes: ['cards'] },
      { id: 'capture', label: 'Capture', objects: ['people', 'interaction'], route: 'POST /scene/interact', writes: ['people', 'interactions'], note: 'outbound always logged' },
      { id: 'post', label: 'Post + track', objects: ['card'], route: 'POST /seeding/mark-posted', writes: ['cards'] },
      { id: 'insights', label: 'Insights', objects: ['card', 'people', 'interaction'], route: 'POST /seeding/insights', writes: ['cards', 'interactions', 'people'] },
    ],
  },
  {
    key: 'backend', family: 'backend', label: 'Backend (AI reply + track)',
    desc: 'Server chain for a typical AI reply: resolve → gen → post → track.',
    steps: [
      { id: 'auth', label: 'Auth', objects: [], note: 'checkAuth Bearer MOS2_EXT_KEY' },
      { id: 'resolve', label: 'Resolve', objects: ['habitat', 'brief'], route: 'GET /habitats/resolve', note: 'reads habitat + active brief' },
      { id: 'create', label: 'Create card', objects: ['card'], writes: ['cards'], note: "createPostForBriefPhase status='drafting'" },
      { id: 'gen', label: 'Generate', objects: ['card', 'brief', 'account', 'generator', 'externalApi'], note: 'Claude/Astrolas w/ brief + persona + format preset' },
      { id: 'respond', label: 'Respond', objects: ['card'], note: 'return draft to extension' },
      { id: 'posted', label: 'Mark posted', objects: ['card'], route: 'POST /seeding/mark-posted', writes: ['cards'] },
      { id: 'track', label: 'Track replies', objects: ['people', 'interaction'], writes: ['people', 'interactions'], note: 'replier → person, familiarity++' },
      { id: 'insights', label: 'Insights', objects: ['card', 'interaction', 'people'], route: 'POST /seeding/insights', writes: ['cards', 'interactions', 'people'] },
    ],
  },
];

export const FLOW_BY_KEY: Record<string, ArchFlow> = Object.fromEntries(FLOWS.map((f) => [f.key, f]));

// ── Canon registry (behavioral "x-entity") ──────────────────────────────────
// One behavioral concept = one resolver, referenced by BOTH runtimes, shown ONCE
// here. The cure for mirror-by-memory drift (viewer-handle whack-a-mole, x/twitter
// row-split, vanillaforums engine-regex…). Backend home = lib/canon (re-exports the
// real lib); ext home = MOS2.resolve.* (core/resolve.js). Phase B codegen emits
// canon.generated.{ts,js} from the backend libs so the ext literal can't drift;
// canonChecks() (Phase C) diffs them into a red drift edge.
// See decisions/2026-06-25-crew-behavioral-registry-xentity.md.
export interface CanonEntity {
  key: string;
  label: string;
  group: 'infra';
  signature: string;           // resolver shape, e.g. 'field(raw, pageKind) → canonicalKey'
  backendRef: string;          // canon.* + source lib
  extRef: string;              // MOS2.resolve.* / core file
  generatedFrom?: string;      // codegen source (Phase B), if a cross-runtime contract
  references: { file: string; line?: number }[];  // canonical home(s)
}

export const CANON: CanonEntity[] = [
  {
    key: 'fieldCanon', label: 'Field-name canon', group: 'infra',
    signature: 'field(raw, pageKind) → canonical key (dotted-preserving + page-kind alias)',
    backendRef: 'canon.field → lib/selector-field-canon.ts canonField',
    extRef: 'MOS2.resolve.field → core/util.js canonFieldKey (mechanical; alias via Phase B)',
    generatedFrom: 'FIELD_ALIASES + PRESERVE_DOTTED + mechCanon regex',
    references: [
      { file: 'apps/web/src/lib/selector-field-canon.ts', line: 65 },
      { file: 'mos2-crew/core/util.js', line: 13 },
    ],
  },
  {
    key: 'platformKey', label: 'Platform key', group: 'infra',
    signature: 'platformKey(host) → ext key; canonical(key) → catalog key (x→twitter)',
    backendRef: 'canon.platformKey / canon.platformFromUrl → lib/habitat-platform-map.ts',
    extRef: 'MOS2.resolve.platformKey/platformCanonical → core/platform.js',
    generatedFrom: 'HOSTS table + CANON/PLATFORM_ALIAS',
    references: [
      { file: 'apps/web/src/lib/habitat-platform-map.ts', line: 73 },
      { file: 'mos2-crew/core/platform.js', line: 13 },
    ],
  },
  {
    key: 'scopeKind', label: 'Scope tier', group: 'infra',
    signature: "scopeKind(s) → 'technology'|'platform'|'habitat' (legacy 'engine'→'technology')",
    backendRef: 'canon.scopeKind → lib/scope-kind.ts normScopeKind',
    extRef: 'MOS2.resolve.scope → core/registry.js scopeFor',
    references: [
      { file: 'apps/web/src/lib/scope-kind.ts', line: 14 },
      { file: 'mos2-crew/core/registry.js', line: 46 },
    ],
  },
  {
    key: 'engineKey', label: 'Forum engine', group: 'infra',
    signature: 'isEngine(key) → bool (phpbb/xenforo/… known forum engine)',
    backendRef: '(validated vs platform_technologies DB)',
    extRef: 'MOS2.resolve.isEngine → core/registry.js ENGINE_KEYS',
    generatedFrom: 'ENGINE_KEYS set',
    references: [{ file: 'mos2-crew/core/registry.js', line: 32 }],
  },
  {
    key: 'habitatKind', label: 'Habitat kind', group: 'infra',
    signature: 'habitatKind(platformKey) → default kind (reddit→subreddit, twitter→hashtag)',
    backendRef: 'canon.habitatKind → lib/habitat-platform-map.ts defaultKindForPlatformKey',
    extRef: '(ext sends platformKey; backend stamps kind)',
    references: [{ file: 'apps/web/src/lib/habitat-platform-map.ts', line: 46 }],
  },
  {
    key: 'viewerHandle', label: 'Viewer handle', group: 'infra',
    signature: 'viewerHandle(pk) → { handle, src, trusted } (db-first; single writer)',
    backendRef: '(DOM-resolved; backend stores the viewer.handle selector row)',
    extRef: 'MOS2.resolve.viewerHandle → MOS2.resolveViewerHandle; single writer = content.js myHandle',
    references: [
      { file: 'mos2-crew/crew-detector.js', line: 500 },
      { file: 'mos2-crew/content.js', line: 608 },
    ],
  },
  {
    key: 'boardClass', label: 'Board / community identity', group: 'infra',
    signature: 'boardKey(url) → { platformKey, externalId, kind, name } discriminator',
    backendRef: 'canon.boardKey → lib/board-radar.ts boardKeyFromUrl',
    extRef: '(content.js communityCandidate — unify pending, see decision risk note)',
    references: [{ file: 'apps/web/src/lib/board-radar.ts' }],
  },
];

export const CANON_BY_KEY: Record<string, CanonEntity> = Object.fromEntries(CANON.map((c) => [c.key, c]));

// All object table names — allowlist for instance binding (guards SQL).
export const BINDABLE_TABLES: Record<string, ArchObject> = Object.fromEntries(
  OBJECTS.filter((o) => o.table).map((o) => [o.key, o]),
);
