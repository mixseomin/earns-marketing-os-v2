// MOS v2 — Drizzle schema (7 core tables, SaaS-ready)
//
// Design rules:
// - tenantId on every table (decision 2026-04-28 SaaS-ready). Default 'self' for solo.
// - createdAt/updatedAt timestamps with default now().
// - Primary keys: text slug (id) for projects/modes (human-readable URLs).
//   bigserial (id) for cards/alerts/feed/squads/agents (machine).
// - cards/alerts/feed/squads scoped to (tenantId, projectId).
// - jsonb for flex fields: tags, sparks, extra mode payload (revChart/topList/suggestions).
// - Enum-like checks deferred to phase 5 (CHECK constraints) — too brittle while shape evolves.

import {
  pgTable,
  text,
  integer,
  decimal,
  smallint,
  boolean,
  jsonb,
  timestamp,
  bigserial,
  bigint,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ── modes ────────────────────────────────────────────────────────
// Mode = template KPI/squads/columns/cards/feed/alerts shape per project.
// Static-ish: bundled with seed, rarely edited at runtime.
export const modes = pgTable(
  'modes',
  {
    id: text('id').primaryKey(),                          // 'affiliate', 'marketing', ...
    tenantId: text('tenant_id').notNull().default('self'),
    label: text('label').notNull(),
    sub: text('sub').notNull().default(''),
    accent: text('accent').notNull().default('cyan'),
    pageTitle: text('page_title').notNull(),
    pageSub: text('page_sub'),
    boardTitle: text('board_title').notNull(),
    squadsTitle: text('squads_title').notNull(),
    livePill: text('live_pill'),
    // statusbar
    statusSpend: text('status_spend'),
    statusSpendVal: text('status_spend_val'),
    statusSpendCap: text('status_spend_cap'),
    statusQueue: text('status_queue'),
    statusTasksMin: text('status_tasks_min'),
    // kill switch
    killCap: text('kill_cap'),
    killUsed: text('kill_used'),
    // bulk payload — kpis/columns/revChart/revData/topList/suggestions/extraTab
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('modes_tenant_idx').on(t.tenantId)],
);

// ── projects ─────────────────────────────────────────────────────
export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),                          // 'aff-vn', 'orit', ...
    tenantId: text('tenant_id').notNull().default('self'),
    name: text('name').notNull(),
    emoji: text('emoji').notNull().default('📦'),
    modeId: text('mode_id').notNull().references(() => modes.id),
    agentsCore: integer('agents_core').notNull().default(0),
    agentsShared: integer('agents_shared').notNull().default(0),
    budget: integer('budget').notNull().default(0),       // tr/day
    health: smallint('health').notNull().default(80),     // 0-100
    revenue: text('revenue').notNull().default('—'),       // free-form display: '45tr', '184tr MRR'
    kpi: text('kpi').notNull().default(''),
    alerts: smallint('alerts').notNull().default(0),       // count badge
    color: text('color').notNull().default('#00e5ff'),
    // is_demo = true cho 10 demo projects ported từ MOS2 design (aff-vn,
    // brand-x, ...). Các project thật (Orit, Astrolas, user-created) = false.
    // Demo: render mock content trong tabs cho design preview.
    // Real: render only DB data; thiếu data → EmptyState.
    isDemo: boolean('is_demo').notNull().default(false),
    // ai_enabled = false để tắt OpenAI calls cho project này (kill switch
    // per-project). Default true cho real projects; demos không gọi AI dù flag true.
    aiEnabled: boolean('ai_enabled').notNull().default(true),
    // ── Brand fields (used by content snippet templates per-account) ──
    // These centralize the per-project values that snippet placeholders
    // {{website}} {{one-liner}} {{bio}} {{persona}} {{hashtags}} pull from.
    // Edit once in /p/[id]/settings → applies to every account on every platform.
    website: text('website').notNull().default(''),
    oneLiner: text('one_liner').notNull().default(''),
    bio: text('bio').notNull().default(''),
    persona: text('persona').notNull().default(''),
    hashtags: text('hashtags').notNull().default(''),       // free-form: '#saas #indie #dev'
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('projects_tenant_idx').on(t.tenantId), index('projects_mode_idx').on(t.modeId)],
);

// ── squads ───────────────────────────────────────────────────────
// Per-project group of agents. squadKey is the slug used in cards.squad / feed.agent_ref.
export const squads = pgTable(
  'squads',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    squadKey: text('squad_key').notNull(),                 // 'research', 'content', ...
    name: text('name').notNull(),
    vi: text('vi').notNull().default(''),
    icon: text('icon').notNull().default('🤖'),
    agents: smallint('agents').notNull().default(0),
    active: smallint('active').notNull().default(0),
    color: text('color').notNull().default('#00e5ff'),
    descText: text('desc_text').notNull().default(''),
    health: text('health').notNull().default('ok'),        // ok | warn | bad
    // Per-squad AI config: skills, tools, mission, systemPrompt, model, trustLevel.
    // Empty {} default means squad chưa configure — UI hiện "config now" CTA.
    config: jsonb('config').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('squads_project_key_uniq').on(t.projectId, t.squadKey),
    index('squads_tenant_idx').on(t.tenantId),
  ],
);

// ── agents ───────────────────────────────────────────────────────
// Individual AI worker. agentRef like 'RES-04', 'CON-09'. Membership in squad optional.
export const agents = pgTable(
  'agents',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    squadId: integer('squad_id').references(() => squads.id, { onDelete: 'set null' }),
    agentRef: text('agent_ref').notNull(),                  // 'RES-04'
    label: text('label'),                                   // optional human name
    status: text('status').notNull().default('active'),     // active | throttled | down | retired
    trustLevel: smallint('trust_level').notNull().default(2),
    baseSkillMd: text('base_skill_md').notNull().default(''),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('agents_project_ref_uniq').on(t.projectId, t.agentRef),
    index('agents_tenant_idx').on(t.tenantId),
    index('agents_squad_idx').on(t.squadId),
  ],
);

// ── agent_messages ───────────────────────────────────────────────
// Persistent chat history per agent. role: 'user' | 'assistant'.
export const agentMessages = pgTable(
  'agent_messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    agentId: bigint('agent_id', { mode: 'number' }).notNull().references(() => agents.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_messages_agent_time').on(t.agentId, t.createdAt),
  ],
);

// ── cards ────────────────────────────────────────────────────────
// Command Board cards. cardRef like 'OFR-2891'. col is column key from mode.columns.
export const cards = pgTable(
  'cards',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    cardRef: text('card_ref').notNull(),                    // 'OFR-2891'
    col: text('col').notNull(),                             // 'needs', 'deciding', 'approved', ...
    // title = bản đăng thật (theo target_lang). Khi target_lang='vi' thì
    // titleReview merge với title. titleReview luôn vi để operator review.
    title: text('title').notNull(),
    titleReview: text('title_review').notNull().default(''),     // 0067: bilingual
    squadKey: text('squad_key').notNull(),                  // FK-by-key into squads.squadKey (denorm for speed)
    level: smallint('level').notNull().default(2),          // 1-4 trust level
    money: text('money'),                                   // free-form: '+est. 18tr/tháng', '-2.4tr/ngày'
    due: text('due').notNull().default('—'),
    urgent: boolean('urgent').notNull().default(false),
    tags: jsonb('tags').notNull().default([]),
    agentRef: text('agent_ref'),
    // Phase 10 agent_kind dispatch:
    //   'gpt-4o-mini' / 'claude-haiku-4-5' / 'claude-sonnet-4-6' → API agent (worker daemon picks up).
    //   'claude-code' → IDE agent via MCP (chờ user start session pull).
    //   'human' → queue human_tasks (worker skip).
    //   NULL → not assigned, không exec.
    agentKind: text('agent_kind'),
    idempotencyKey: text('idempotency_key'),                // anti double-exec across retries
    // Phase 10 dispatch gate (mode-agnostic, KHÔNG phụ thuộc col vì mỗi mode
    // có column khác nhau). Worker daemon chỉ pick card với dispatch_ready=true
    // + agent_kind set. User explicit toggle "Ready to dispatch" trong card form.
    dispatchReady: boolean('dispatch_ready').notNull().default(false),
    // Workflow chain (Phase 12+): khi card thuộc multi-step flow.
    workflowRunId: text('workflow_run_id'),                 // unique ID groups all steps của 1 chain instance
    workflowKey: text('workflow_key'),                      // e.g. 'reddit-launch' — workflow definition slug
    workflowStep: text('workflow_step'),                    // e.g. 'plan' / 'write' / 'design' / 'publish'
    workflowContext: jsonb('workflow_context').notNull().default({}),  // outputs từ prev steps cho input mapping
    body: text('body'),
    // 0051: liên kết card về (community_brief × phase) để PhaseEntryEditor
    // có thể list + tạo card từ context phase. NULL khi card không thuộc brief.
    briefId: bigint('brief_id', { mode: 'number' }),
    briefPhase: text('brief_phase'),
    // 0052: bilingual posts. body_review luôn vi-VN (review). body_target
    // theo target_lang (= habitat.language) - đăng thật. Khi target_lang='vi'
    // thì 2 trường merge thành 1 (chỉ dùng body_target).
    bodyReview: text('body_review').notNull().default(''),
    bodyTarget: text('body_target').notNull().default(''),
    targetLang: text('target_lang').notNull().default('en'),
    // 0068: URL thread/post gốc cho comment/reply (interaction types).
    // NULL = standalone post. AI prompt nạp parent context khi present.
    parentUrl: text('parent_url'),
    // 0069: parent thread/post content cho AI gen reply có context.
    // 4 fields nullable, chỉ dùng khi content_type IN ('comment','reply').
    parentTitle: text('parent_title'),
    parentBody: text('parent_body'),
    parentAuthor: text('parent_author'),
    parentSnippets: jsonb('parent_snippets').notNull().default([]),
    // 0070: track nguồn body_target. 'astrolas' = từ Astrolas QA API (có sources[]).
    answerSource: text('answer_source'),
    answerSources: jsonb('answer_sources').notNull().default([]),
    // 0072: gen meta — cost/duration/model/confidence cho draft history UI
    genCostUsd: decimal('gen_cost_usd', { precision: 8, scale: 5 }),
    genDurationMs: integer('gen_duration_ms'),
    genModelUsed: text('gen_model_used'),
    genConfidence: decimal('gen_confidence', { precision: 3, scale: 2 }),
    genToolsCalled: jsonb('gen_tools_called').notNull().default([]),
    genWarnings: jsonb('gen_warnings').notNull().default([]),
    genLogId: text('gen_log_id'),
    // 0055: content-type-aware seeding. content_type = text|image|video|
    // link|thread|poll|carousel|story|doc (xem lib/content-formats.ts).
    // media_asset_id = link tuỳ chọn tới media_assets (ảnh/video kèm bài).
    contentType: text('content_type').notNull().default('text'),
    mediaAssetId: bigint('media_asset_id', { mode: 'number' }),
    // Channel link — chỉ có giá trị với habitat multi-channel (Discord/Slack/
    // Telegram). Null = habitat-level (subreddit/forum 1 ruleset).
    channelId: bigint('channel_id', { mode: 'number' }),
    // Content Pillar System — link to project's macro content positioning.
    // Pillar inherit voice + key_messages + forbidden + languages cho bài.
    // Null = legacy / no pillar (behavior y như cũ).
    pillarId: bigint('pillar_id', { mode: 'number' }),
    // Distribution kind (khác content_type là medium). seed = community post,
    // blog = website article, email = newsletter, thread = X/LinkedIn thread.
    // Default 'seed' để backward-compat cards cũ.
    contentKind: text('content_kind').notNull().default('seed'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    // Lý do archive — dùng cho format-removed auto-restore: nếu reason match
    // 'format-removed:<type>' và format bật lại → tự unarchive.
    archivedReason: text('archived_reason'),
    // Dispatch / đã đăng — set khi user bấm "🚀 Đăng bài" + confirm modal.
    // postUrl = link bài thật trên platform (Reddit thread, Discord msg link, ...).
    // postedAt = timestamp khi bài đăng (auto-fill now() nhưng có thể override).
    // postScreenshotUrl = ảnh chụp pin làm bằng chứng (optional).
    // postNote = ghi chú free-text (vd "mod approved x mins", "shadow ban").
    postUrl: text('post_url'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    postScreenshotUrl: text('post_screenshot_url'),
    postNote: text('post_note'),
    // Lifecycle: live | ghosted | removed-by-mod | self-deleted | low-engagement
    // User mark manual khi phát hiện, hoặc cron auto-detect (Phase D).
    postLifecycle: text('post_lifecycle'),
    postLifecycleAt: timestamp('post_lifecycle_at', { withTimezone: true }),
    postLifecycleNote: text('post_lifecycle_note'),
    // Insights data — ext scrape Reddit commentstats/<id> bằng user session,
    // POST /api/ext/seeding/insights save. Cron stale > 24h re-fetch sau.
    insightsViewsCount: integer('insights_views_count'),
    insightsScore: integer('insights_score'),                                  // ups - downs
    insightsUpvoteRatio: decimal('insights_upvote_ratio', { precision: 4, scale: 3 }),
    insightsReplyCount: integer('insights_reply_count'),
    insightsShareCount: integer('insights_share_count'),
    insightsAwardCount: integer('insights_award_count'),
    insightsFetchedAt: timestamp('insights_fetched_at', { withTimezone: true }),
    insightsRawJson: jsonb('insights_raw_json'),
    // Geo breakdown: [{ country: 'Vietnam', pct: 78 }, ...] — sort desc
    insightsTopCountries: jsonb('insights_top_countries'),
    // Top replies snapshot: [{ author, ago, body, score }] — text only,
    // không track replies URLs (Reddit không expose qua insights page).
    insightsTopReplies: jsonb('insights_top_replies'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cards_project_ref_uniq').on(t.projectId, t.cardRef),
    index('cards_tenant_idx').on(t.tenantId),
    index('cards_project_col_idx').on(t.projectId, t.col),
    index('cards_agent_kind_idx').on(t.agentKind),         // worker daemon filter
  ],
);

// ── alerts ───────────────────────────────────────────────────────
export const alerts = pgTable(
  'alerts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    alertRef: text('alert_ref').notNull(),                  // 'A1'
    tone: text('tone').notNull().default('warn'),           // bad | warn | info | ok
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    timeLabel: text('time_label').notNull().default(''),    // '01:28 ago' display
    tags: jsonb('tags').notNull().default([]),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('alerts_project_ref_uniq').on(t.projectId, t.alertRef),
    index('alerts_tenant_idx').on(t.tenantId),
    index('alerts_project_resolved_idx').on(t.projectId, t.resolvedAt),
  ],
);

// ── feed_events ──────────────────────────────────────────────────
// Activity stream for RightBar feed. Append-only; truncate via TTL job in phase 5.
export const feedEvents = pgTable(
  'feed_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    timeLabel: text('time_label').notNull(),                 // '07:42:18' display
    agentRef: text('agent_ref').notNull(),
    lvl: smallint('lvl').notNull().default(1),
    action: text('action').notNull(),
    target: text('target').notNull().default(''),
    isNew: boolean('is_new').notNull().default(false),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('feed_tenant_idx').on(t.tenantId),
    index('feed_project_time_idx').on(t.projectId, t.occurredAt),
  ],
);

// ── platform_technologies ────────────────────────────────────────
// Catalog of forum/CMS engines (vBulletin, XenForo, Discourse…).
// signup_fields = default registration field requirements for this engine.
// platforms and habitats can link here; effective fields = tech defaults
// merged with platform-specific overrides (platform wins on same key).
export const platformTechnologies = pgTable('platform_technologies', {
  key:          text('key').primaryKey(),            // 'vbulletin', 'xenforo'
  label:        text('label').notNull(),             // 'vBulletin'
  description:  text('description').notNull().default(''),
  signupFields: jsonb('signup_fields').notNull().default([]),
  notes:        text('notes'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// signup_fields element shape (stored in both platformTechnologies and platforms):
// {
//   key: string,          -- 'dob' | 'gender' | 'captcha' | 'phone' | …
//   label: string,
//   type: 'text' | 'date' | 'select' | 'boolean' | 'phone' | 'email' | 'captcha' | 'info',
//   required: boolean,
//   notes?: string,       -- tip/gotcha for this field
//   placeholder?: string,
//   options?: string[],   -- only for type='select'
// }

// ── platforms ────────────────────────────────────────────────────
// Catalog of social/community/content platforms. Shared across tenants
// (tenant_id default 'self'); seed once, edit centrally. Per-tenant
// override via separate row will work later if needed (key+tenant_id).
export const platforms = pgTable(
  'platforms',
  {
    key: text('key').primaryKey(),                          // 'producthunt'
    tenantId: text('tenant_id').notNull().default('self'),
    label: text('label').notNull(),                         // 'Product Hunt'
    signupUrl: text('signup_url').notNull(),
    postUrl: text('post_url'),
    // Profile URL pattern, vd 'https://www.reddit.com/user/{handle}'.
    // NULL → fallback sang hardcoded helper trong apps/web/src/lib/platform-profile-urls.ts.
    profileUrlPattern: text('profile_url_pattern'),
    priority: text('priority').notNull().default('medium'), // 'critical' | 'high' | 'medium'
    fallbackKeys: jsonb('fallback_keys').notNull().default([]),
    iconSlug: text('icon_slug').notNull().default(''),
    imageSpecs: jsonb('image_specs').notNull().default([]),
    checklist: jsonb('checklist').notNull().default([]),
    autoCheck: boolean('auto_check').notNull().default(false),
    // Phase 9 capability matrix: agent có thể tự đăng được hay phải human.
    // FB/IG/TikTok DM block bots → autoPostSupported=false → publisher toolkit
    // auto-fallback queue human_tasks. Default true (most platforms have API).
    autoPostSupported: boolean('auto_post_supported').notNull().default(true),
    // Phase 14 metadata (migration 0029) — richer info card in PlatformPicker
    description: text('description').notNull().default(''),
    pricing: text('pricing'),
    region: text('region'),                              // ISO country code or 'global'
    category: text('category').notNull().default('other'), // tech / social / video / blog / launch / community / marketplace / messaging / newsletter / design / other
    tags: jsonb('tags').notNull().default([]),
    userCountEstimate: text('user_count_estimate'),       // human-readable: "1B+", "10M MAU"
    notes: text('notes'),
    // migration 0044: forum engine + per-platform signup field overrides
    technologyKey: text('technology_key').references(() => platformTechnologies.key, { onDelete: 'set null' }),
    signupFields: jsonb('signup_fields').notNull().default([]), // platform-specific additions/overrides
    // Override content formats hardcoded (content-formats.ts PROFILE_BY_KEY/CATEGORY).
    // allowedFormats = JSONB array of format keys; NULL = dùng hardcoded fallback.
    // formatMix = JSONB object {format_key: weight}.
    allowedFormats: jsonb('allowed_formats'),
    formatMix: jsonb('format_mix'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('platforms_tenant_idx').on(t.tenantId), index('platforms_priority_idx').on(t.priority), index('platforms_category_idx').on(t.category)],
);

// ── platform_accounts ────────────────────────────────────────────
// Tenant-level accounts on platforms (Product Hunt, HackerNews, Reddit, ...).
// projectId = legacy "owner/creator project" (nullable). For full multi-brand
// mapping (1 account ↔ N projects với content_ratio), JOIN qua project_accounts.
// status state machine: todo → creating → warming → active (linear)
// side-states: limited / blocked / banned (reachable from any).
// warmup_checklist mirrors the platforms.checklist shape, with per-item progress.
export const platformAccounts = pgTable(
  'platform_accounts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    platformKey: text('platform_key').notNull().references(() => platforms.key),
    handle: text('handle'),
    email: text('email'),
    status: text('status').notNull().default('todo'),
    authMethod: text('auth_method'),
    has2fa: boolean('has_2fa').notNull().default(false),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    recoveryInfo: text('recovery_info'),
    apiTokenEnc: text('api_token_enc'),       // encrypted at rest (pgcrypto, phase 3)
    monthlyCost: integer('monthly_cost').notNull().default(0),
    collectStats: boolean('collect_stats').notNull().default(false),
    blockReason: text('block_reason'),
    notes: text('notes'),
    tags: jsonb('tags').notNull().default([]),
    warmupChecklist: jsonb('warmup_checklist').notNull().default({}),
    // Phase 9 capability flags per-account:
    // cookieSessionNeeded: account chỉ login qua browser cookie, không API token (e.g., FB).
    // lastUsedAt: rotation tracking — agent không reuse account nào vừa dùng < cooldown.
    cookieSessionNeeded: boolean('cookie_session_needed').notNull().default(false),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    // Phase 14: account environment — anti-detect setup
    // environment JSONB structure (free-form, evolve over time):
    //   { browser_profile_label, user_agent_pin, cookies_path, totp_secret_enc, sticky_session_id }
    // proxyId / browserProfileId: normalized FKs (added 0028) — JSONB still works for ad-hoc keys.
    environment: jsonb('environment').notNull().default({}),
    proxyId: bigint('proxy_id', { mode: 'number' }),
    browserProfileId: bigint('browser_profile_id', { mode: 'number' }),
    // Phase 14 (migration 0035): per-member ownership for operator scoping
    ownerUserId: bigint('owner_user_id', { mode: 'number' }),
    // migration 0045: persona — character brief for pre-deployment prep
    // { dob, gender, country, city, name_first, name_last, phone, backstory, interests[] }
    persona: jsonb('persona').notNull().default({}),
    // migration 0058: account_kind — phân biệt user vs bot/app account.
    // 'user' (default) = manual login, cần warming + persona + voice.
    // 'bot' = Discord/Slack bot, có bot_token, không warming, không persona.
    // 'app' = OAuth integration (Reddit script-app), tương tự bot.
    accountKind: text('account_kind').notNull().default('user'),
    clientId: text('client_id'),
    botTokenEnc: text('bot_token_enc'),  // pgcrypto encrypted bytea (text-encoded base64)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('accounts_tenant_idx').on(t.tenantId),
    index('accounts_project_idx').on(t.projectId),
    index('accounts_platform_idx').on(t.platformKey),
    index('accounts_status_idx').on(t.projectId, t.status),
    uniqueIndex('accounts_tenant_platform_handle_uniq').on(t.tenantId, t.platformKey, t.handle),
  ],
);

// ── project_accounts (pivot, multi-brand) ────────────────────────
// 1 platform_account có thể được dùng bởi nhiều projects (vd: @tuan_builds
// trên X dùng cho cả Astrolas + Orit). content_ratio = % content từ account
// này dành cho project này (tổng các share nên ~100).
export const projectAccounts = pgTable(
  'project_accounts',
  {
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    accountId: bigint('account_id', { mode: 'number' }).notNull().references(() => platformAccounts.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('shared'),                  // 'primary' | 'shared'
    contentRatio: integer('content_ratio').notNull().default(0),     // 0-100
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('project_accounts_account_idx').on(t.accountId),
  ],
);

// ── account_grants (share account cho agents/users khác ngoài owner) ─
// Owner (platform_accounts.owner_user_id) = 1 user chính. Bảng này thêm
// quyền sử dụng cho N entity khác — vd: account Reddit owner=Hoàng Tuấn,
// share cho agent RES-04 + human Linh để cùng dùng (không phải owner).
export const accountGrants = pgTable(
  'account_grants',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    accountId: bigint('account_id', { mode: 'number' }).notNull().references(() => platformAccounts.id, { onDelete: 'cascade' }),
    granteeKind: text('grantee_kind').notNull(),    // 'agent' | 'user'
    granteeId: text('grantee_id').notNull(),         // agent_ref string, hoặc user_id::text
    role: text('role').notNull().default('use'),     // 'use' | 'admin'
    notes: text('notes'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    grantedBy: bigint('granted_by', { mode: 'number' }),
  },
  (t) => [
    index('account_grants_account_idx').on(t.accountId),
    index('account_grants_grantee_idx').on(t.granteeKind, t.granteeId),
  ],
);

// ── proxies ──────────────────────────────────────────────────────
// Reusable proxy pool — accounts reference one. Type categorizes IP origin.
export const proxies = pgTable(
  'proxies',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    label: text('label').notNull(),
    type: text('type').notNull().default('datacenter'),    // mobile|residential|datacenter|isp
    endpoint: text('endpoint').notNull(),                  // user:pass@host:port
    location: text('location'),                            // SG-Singapore, US-NY, ...
    health: text('health').notNull().default('unknown'),   // ok|degraded|down|unknown
    lastCheckAt: timestamp('last_check_at', { withTimezone: true }),
    costPerGbCents: integer('cost_per_gb_cents').notNull().default(0),
    rotatesAt: timestamp('rotates_at', { withTimezone: true }),
    notes: text('notes'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('proxies_tenant_idx').on(t.tenantId),
    index('proxies_type_idx').on(t.type),
  ],
);

// ── browser_profiles ─────────────────────────────────────────────
// Anti-detect browser profile (GenLogin / Multilogin / AdsPower / native Chrome).
// Linked from platform_accounts.browser_profile_id.
export const browserProfiles = pgTable(
  'browser_profiles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    label: text('label').notNull(),                        // GL-orit-medium-01
    tool: text('tool').notNull(),                          // genlogin|multilogin|adspower|kameleo|chrome|firefox
    externalId: text('external_id'),                       // profile UUID from the tool
    userAgent: text('user_agent'),
    fingerprint: jsonb('fingerprint').notNull().default({}),
    defaultProxyId: bigint('default_proxy_id', { mode: 'number' }),
    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
    notes: text('notes'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('browser_profiles_tenant_idx').on(t.tenantId),
    index('browser_profiles_tool_idx').on(t.tool),
  ],
);

// ── tribes (audience identity, layer 2) ──────────────────────────
// Per-project audience cluster. Mirrors as.on.tc 'communities' collection.
export const tribes = pgTable(
  'tribes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    descText: text('desc_text').notNull().default(''),
    signal: text('signal').notNull().default(''),         // why this tribe matters
    sentiment: smallint('sentiment').notNull().default(0), // -100..+100
    lifecycle: text('lifecycle').notNull().default('discovery'), // discovery|active|saturated|fading
    lexicon: jsonb('lexicon').notNull().default([]),       // words used by tribe
    avoid: jsonb('avoid').notNull().default([]),           // terms to avoid
    psychographic: text('psychographic').notNull().default(''),
    importedFrom: text('imported_from'),                   // 'directus:<uuid>' if synced
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('tribes_project_slug_uniq').on(t.projectId, t.slug),
    index('tribes_tenant_idx').on(t.tenantId),
  ],
);

// ── habitats (where tribes hang out, layer 1) ────────────────────
// subreddit, FB group, hashtag cluster, Discord server etc.
export const habitats = pgTable(
  'habitats',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    tribeId: integer('tribe_id').references(() => tribes.id, { onDelete: 'cascade' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('forum'),         // subreddit|fb-group|discord|forum|hashtag|...
    name: text('name').notNull(),
    url: text('url'),
    platformKey: text('platform_key').references(() => platforms.key, { onDelete: 'set null' }), // explicit link cho kinds không tự map (forum/hashtag/other)
    // Icon URL của community (Discord CDN icon, subreddit icon, FB group cover...).
    // Tự fill khi extract từ platform API (Discord invite, Reddit /about).
    iconUrl: text('icon_url'),
    members: integer('members').notNull().default(0),
    activity: text('activity').notNull().default(''),       // free-form: 'high', '120 posts/d'
    scrapeFrequency: text('scrape_frequency').notNull().default('manual'), // live|manual|weekly|comments
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    health: text('health').notNull().default('ok'),        // ok|warn|bad
    importedFrom: text('imported_from'),
    // Outreach meta (mirrors Directus communities)
    language: text('language').notNull().default(''),                              // vi|en|zh|multi|...
    communityType: text('community_type').notNull().default(''),                    // discussion|news|q-a|portfolio|sharing|other
    status: text('status').notNull().default('target'),                             // target|engaged|saturated|banned|dormant
    modStrictness: text('mod_strictness').notNull().default(''),                    // low|medium|high
    postingRules: text('posting_rules').notNull().default(''),                      // markdown — full rules
    postingRulesUrl: text('posting_rules_url').notNull().default(''),                // canonical rules page URL
    minAccountAgeDays: integer('min_account_age_days').notNull().default(0),
    minKarma: integer('min_karma').notNull().default(0),
    minPosts: integer('min_posts').notNull().default(0),
    linksAllowedAfter: text('links_allowed_after').notNull().default(''),
    dominantTopics: jsonb('dominant_topics').notNull().default([]),
    forbiddenTopics: jsonb('forbidden_topics').notNull().default([]),
    bestPostTimes: text('best_post_times').notNull().default(''),
    // migration 0044: forum engine detection (can override platform's tech)
    technologyKey: text('technology_key').references(() => platformTechnologies.key, { onDelete: 'set null' }),
    // Override platform.allowed_formats cho community cụ thể (vd r/AskReddit
    // cấm link → habitat bỏ 'link' khỏi list). NULL = kế thừa platform.
    allowedFormatsOverride: jsonb('allowed_formats_override'),
    // Voice profile preset (lurker|regular|shitposter|edgelord|expert|hype) —
    // điều khiển length/emoji/slang/hook style trong AI prompt. Channel có thể
    // override; nếu không thì kế thừa habitat. Default 'regular' (như cũ).
    voiceProfile: text('voice_profile').notNull().default('regular'),
    // Free-text voice notes (admin viết thêm context: "lots of finance bro
    // lingo, ironic technical terms, never serious"). Inject vào prompt sau
    // voice profile preset.
    voiceNotes: text('voice_notes').notNull().default(''),
    // Array of high-performing example posts để AI mimic: [{title, body, whyItWorks}].
    // Inject vào prompt as few-shot examples (sau voice notes, trước task).
    fewShotExamples: jsonb('few_shot_examples'),
    // AI-inferred visual descriptor từ habitat icon (Vision call 1x, cached).
    // VD: "purple cosmic gradient, mystical astrology aesthetic". Inject vào
    // image-gen prompt để ảnh sinh fit theme habitat.
    visualStyleDescriptor: text('visual_style_descriptor'),
    // migration 0059: Reddit sidebar metadata (scrape qua MOS2 Crew ext).
    // createdAtSource: community age — sub mới khó leverage, sub cũ thường strict.
    // privacy: 'public' | 'restricted' | 'private' (= không seed được).
    // weeklyVisitors / weeklyContributions: traffic real + density signal.
    createdAtSource: timestamp('created_at_source', { withTimezone: true }),
    privacy: text('privacy').notNull().default(''),
    weeklyVisitors: integer('weekly_visitors').notNull().default(0),
    weeklyContributions: integer('weekly_contributions').notNull().default(0),
    // migration 0063: mô tả community (paragraph từ Reddit "About community")
    description: text('description').notNull().default(''),
    // migration 0064: display title — khác name (r/slug primary identifier),
    // đây là tên hiển thị đầu sidebar ("Astrology Memes" vs "r/astrologymemes").
    // Optional — fallback name nếu chưa scrape.
    title: text('title').notNull().default(''),
    // migration 0066: generic kv storage cho mọi custom field user
    // thêm qua MOS2 Crew ext (official_website, discord_invite, twitter,
    // telegram, etc.) — tránh ALTER TABLE mỗi field mới.
    // Ext POST /api/ext/habitats với scraped_meta object, server merge.
    scrapedMeta: jsonb('scraped_meta').notNull().default({}),
    // Flag: habitat có cơ chế tự động detect AI content (mod tool / auto-mod
    // rule / Reddit's quality filter). Khi true, AI gen prompt phải:
    //   - Né markdown overuse (** _ # bullets)
    //   - Né em dash '—'
    //   - Voice human hơn (cá nhân, hesitation, typo nhẹ)
    //   - Tránh "Hi, I'm an AI..." patterns
    aiContentDetection: boolean('ai_content_detection').notNull().default(false),
    aiDetectionNote: text('ai_detection_note'),
    // 0077: habitat own brand mình (Discord server own, FB group, subreddit user mod)
    // vs external community. UI hiển thị 👑 + AI prompt có thể đổi tone.
    isOwn: boolean('is_own').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('habitats_tenant_idx').on(t.tenantId),
    index('habitats_tribe_idx').on(t.tribeId),
    index('habitats_project_idx').on(t.projectId),
  ],
);

// ── habitat_channels — sub-channel của habitat (Discord/Slack/Telegram) ──
// 1 server có nhiều channel với rule + format riêng (off-topic / promo /
// showcase…). Card có channel_id để biết bài đăng cụ thể vào channel nào.
// Cards.channel_id nullable: subreddit/forum chỉ có 1 ruleset → không cần.
export const habitatChannels = pgTable(
  'habitat_channels',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    habitatId: integer('habitat_id').notNull().references(() => habitats.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),                          // '#promo' / '#showcase' / 'general'
    url: text('url'),                                       // deep-link channel nếu có
    description: text('description').notNull().default(''),// off-topic / showcase / Q&A...
    rules: text('rules').notNull().default(''),             // markdown — channel-specific
    allowedFormats: jsonb('allowed_formats'),               // override habitat-level
    postingGates: jsonb('posting_gates'),                   // {minAge, minKarma, linksAllowedAfter...}
    // Channel-level voice override. NULL = kế thừa habitat.voiceProfile.
    // Vd habitat shitposter + #rules channel = 'regular' để bài #rules đỡ trolling.
    voiceProfileOverride: text('voice_profile_override'),
    // Few-shot examples specific cho channel này. NULL = kế thừa habitat.fewShotExamples.
    fewShotExamples: jsonb('few_shot_examples'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('habitat_channels_habitat_idx').on(t.habitatId)],
);

// ── content_pillars (macro content positioning per project) ─────────
// Top-level brand/content strategy: 3-5 trụ cột định nghĩa "viết cho ai",
// "key messages", "forbidden", "voice", "languages supported". Cards
// (blog + seeding + email + thread) link tới pillar để inherit positioning.
// Brief có primary_pillar_id để default mọi card trong brief.
export const contentPillars = pgTable(
  'content_pillars',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline').notNull().default(''),
    positioningMd: text('positioning_md').notNull().default(''),
    keyMessages: jsonb('key_messages').notNull().default([]),
    forbiddenMsgs: jsonb('forbidden_msgs').notNull().default([]),
    // Languages this pillar supports — e.g. ['en','vi'] for universal,
    // ['vi'] for VN-cultural-specific. Mismatch language → UI warning.
    languages: jsonb('languages').notNull().default(['en']),
    voiceProfile: text('voice_profile').notNull().default('regular'),
    voiceNotes: text('voice_notes').notNull().default(''),
    // Preferred content_kinds for this pillar (vd ['blog','thread'] for SEO pillar).
    preferredTypes: jsonb('preferred_types').notNull().default([]),
    // Strategic exemplars (high-level — khác habitat few-shot là community-level).
    exemplars: jsonb('exemplars'),
    seoPillarUrl: text('seo_pillar_url'),
    seoKeywords: jsonb('seo_keywords').default([]),
    // Map sang tag enum của external system (Astrolas content_pieces.pillar
    // = mundane|technique|demo|education|weekly-forecast). Khi MOS2 push card
    // sang Directus, dùng tag này để Astrolas dashboard hiển thị đúng.
    // 2 hệ thống độc lập — MOS2 = strategy, content_pieces.pillar = tag layer.
    externalTag: text('external_tag'),
    priority: integer('priority').notNull().default(50),
    status: text('status').notNull().default('active'),                // active|paused|archived
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('content_pillars_project_idx').on(t.projectId),
    uniqueIndex('content_pillars_project_slug_uniq').on(t.projectId, t.slug),
  ],
);

// M2M pillar × tribe — audience targeting
export const contentPillarTribes = pgTable(
  'content_pillar_tribes',
  {
    pillarId: bigint('pillar_id', { mode: 'number' }).notNull().references(() => contentPillars.id, { onDelete: 'cascade' }),
    tribeId: integer('tribe_id').notNull().references(() => tribes.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.pillarId, t.tribeId] })],
);

// ── community_briefs (account × habitat approach plan) ───────────
// Per (persona-account, concrete community) outreach strategy. One row
// stores how this account-persona engages this specific community —
// approach narrative, cadence, tone, do/dont, reusable templates.
export const communityBriefs = pgTable(
  'community_briefs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    accountId: integer('account_id').notNull().references(() => platformAccounts.id, { onDelete: 'cascade' }),
    habitatId: integer('habitat_id').notNull().references(() => habitats.id, { onDelete: 'cascade' }),
    approachMd: text('approach_md').notNull().default(''),
    cadence: text('cadence').notNull().default(''),
    tone: text('tone').notNull().default(''),
    doMd: text('do_md').notNull().default(''),
    dontMd: text('dont_md').notNull().default(''),
    templates: jsonb('templates').notNull().default([]),
    aiSuggestion: jsonb('ai_suggestion'),                                     // last generated AI suggestion (BriefSuggestion shape)
    aiSuggestionAt: timestamp('ai_suggestion_at', { withTimezone: true }),     // when generated
    // 0049: per-phase strategy. currentPhase = which phase this account is in
    // RIGHT NOW for this habitat (warm-up|value|bridge|seed|direct|cooldown|paused).
    // phasePlan = ordered list of PhaseEntry objects, see lib/phase-plan.ts.
    // phaseHistory = append-only log of transitions.
    currentPhase: text('current_phase').notNull().default('warm-up'),
    phasePlan: jsonb('phase_plan').notNull().default([]),
    phaseHistory: jsonb('phase_history').notNull().default([]),
    // 0050: storytelling/narrative guidance markdown - HOW to write the
    // content (story arc, hooks, narrative voice) as opposed to approachMd
    // which is WHERE/WHEN to engage.
    narrativeMd: text('narrative_md').notNull().default(''),
    // Default content pillar cho brief — mọi card tạo trong brief inherit.
    // Override per-card qua cards.pillar_id.
    primaryPillarId: bigint('primary_pillar_id', { mode: 'number' }),
    // 0057: per-brief join membership state (separate from engagement phase).
    // Phase warm-up chỉ có ý nghĩa khi joinStatus='joined'. Pre-join states
    // gate seeding (cannot post to community you haven't joined).
    //   not_joined | pending | joined | rejected | kicked | left
    joinStatus: text('join_status').notNull().default('not_joined'),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    joinUrl: text('join_url'),       // invite link / join request URL
    joinNote: text('join_note'),     // free-text: 'mod requires intro post', 'shadowed', etc.
    // migration 0065: scraped relationship metadata từ ext (key-value flat).
    // Schema declared trong lib/brief-field-schema.ts; reuse selector_overrides
    // với field_name prefix "brief." cho train flow.
    scrapedMeta: jsonb('scraped_meta').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('community_briefs_account_habitat_uniq').on(t.accountId, t.habitatId),
    index('community_briefs_project_idx').on(t.projectId),
    index('community_briefs_account_idx').on(t.accountId),
    index('community_briefs_habitat_idx').on(t.habitatId),
    index('community_briefs_tenant_idx').on(t.tenantId),
    index('community_briefs_current_phase_idx').on(t.currentPhase),
    index('community_briefs_join_status_idx').on(t.joinStatus),
  ],
);

// ── habitat_tribes (M2M: habitat ↔ tribe) ────────────────────────
// One community spans multiple audience tribes. habitats.tribe_id is
// kept as a denormalized PRIMARY-tribe mirror (single-tribe reads keep
// working); this table is the full set. Exactly one row per habitat has
// is_primary=true and it must equal habitats.tribe_id — app code
// (setHabitatTribes) keeps them in sync. See migration 0053.
export const habitatTribes = pgTable(
  'habitat_tribes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    habitatId: integer('habitat_id').notNull().references(() => habitats.id, { onDelete: 'cascade' }),
    tribeId: integer('tribe_id').notNull().references(() => tribes.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('habitat_tribes_uniq').on(t.habitatId, t.tribeId),
    index('habitat_tribes_tribe_idx').on(t.tribeId),
    index('habitat_tribes_habitat_idx').on(t.habitatId),
    index('habitat_tribes_tenant_idx').on(t.tenantId),
  ],
);

// ── seeding_schedules (recurring seeding cadence per brief) ──────
// Brand-awareness / periodic seeding cadence for one community brief
// (account × habitat). next_due = COALESCE(last_seeded_at, created_at)
// + frequency_days, computed on read (no cron in v1). See migration 0054.
export const seedingSchedules = pgTable(
  'seeding_schedules',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    briefId: bigint('brief_id', { mode: 'number' }).notNull().references(() => communityBriefs.id, { onDelete: 'cascade' }),
    // 0056: lanes — mỗi brief có nhiều lịch, key = (brief, content_type,
    // language). content_type='mix' = xoay theo formatMix (tương thích lane
    // cũ); 1 loại cố định = luôn loại đó. language='' = kế thừa
    // habitat.language; 1 mã ngôn ngữ = override khi sinh nháp.
    contentType: text('content_type').notNull().default('mix'),
    language: text('language').notNull().default(''),
    frequencyDays: integer('frequency_days').notNull().default(3),
    activePhases: jsonb('active_phases').notNull().default([]),
    paused: boolean('paused').notNull().default(false),
    autoDraft: boolean('auto_draft').notNull().default(true),
    lastSeededAt: timestamp('last_seeded_at', { withTimezone: true }),
    touchLog: jsonb('touch_log').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('seeding_schedules_brief_lane_uniq').on(t.briefId, t.contentType, t.language),
    index('seeding_schedules_project_idx').on(t.projectId),
    index('seeding_schedules_tenant_idx').on(t.tenantId),
  ],
);

// ── knowledge_items (Resources/Knowledge vault) ──────────────────
export const knowledgeItems = pgTable(
  'knowledge_items',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }), // null = portfolio-wide
    kind: text('kind').notNull().default('playbook'),      // playbook|prompt|template|lesson|gotcha
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    tags: jsonb('tags').notNull().default([]),
    importedFrom: text('imported_from'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('knowledge_tenant_idx').on(t.tenantId),
    index('knowledge_project_idx').on(t.projectId),
    index('knowledge_kind_idx').on(t.kind),
  ],
);

// ── selector_overrides (mig 0061) ────────────────────────────────
// 3-tier inheritance cho LLM-discovered CSS selectors. Ext MOS2 Crew
// fetch resolved map (cascade habitat > platform > engine) khi scrape
// habitat DOM. 1 row = 1 (scope, page_kind, field) triple — field-level
// override không phải map-level.
export const selectorOverrides = pgTable(
  'selector_overrides',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    scopeKind: text('scope_kind').notNull(),    // 'engine' | 'platform' | 'habitat'
    scopeKey: text('scope_key').notNull(),       // techKey | platformKey | habitatId::text
    pageKind: text('page_kind').notNull(),       // 'subreddit-about' | 'forum-thread' ...
    fieldName: text('field_name').notNull(),    // 'members' | 'description' ...
    spec: jsonb('spec').notNull(),               // { css, attr?, parse?, enum_values?, notes? }
    source: text('source').notNull().default('llm'),  // 'llm' | 'manual' | 'promoted'
    confidence: integer('confidence').notNull().default(0),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('selector_overrides_uniq').on(t.tenantId, t.scopeKind, t.scopeKey, t.pageKind, t.fieldName),
    index('selector_overrides_scope_idx').on(t.scopeKind, t.scopeKey, t.pageKind),
  ],
);

// ── ext_call_log (mig 0062) - debug log mọi call ext ────────────
export const extCallLog = pgTable(
  'ext_call_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    endpoint: text('endpoint').notNull(),
    method: text('method').notNull(),
    extVersion: text('ext_version'),
    pageUrl: text('page_url'),
    payloadMeta: jsonb('payload_meta'),
    responseMeta: jsonb('response_meta'),
    status: integer('status'),
    durationMs: integer('duration_ms'),
    errorMsg: text('error_msg'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ext_call_log_endpoint_idx').on(t.endpoint, t.createdAt),
    index('ext_call_log_created_idx').on(t.createdAt),
  ],
);

// ── contacts (Resources/Contacts vault) ──────────────────────────
export const contacts = pgTable(
  'contacts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    role: text('role').notNull().default(''),               // KOC|partner|brand|influencer|press|customer
    company: text('company'),
    socialHandles: jsonb('social_handles').notNull().default({}), // { twitter: '@', linkedin: 'url', ... }
    notes: text('notes'),
    tags: jsonb('tags').notNull().default([]),
    importedFrom: text('imported_from'),
    lastTouchedAt: timestamp('last_touched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('contacts_tenant_idx').on(t.tenantId),
    index('contacts_project_idx').on(t.projectId),
    index('contacts_role_idx').on(t.role),
  ],
);

// ── use_cases ────────────────────────────────────────────────────
// Test cases / use cases registry. Spec columns are seed-managed (AI
// appends when shipping a feature) and idempotent-upserted on every
// deploy. State columns (status, feedback, last_tested_at) are managed
// by the user via the /tests UI and NEVER overwritten by re-seed.
//
// slug naming convention: '<group>-<seq>-<short-id>'
//   '1.1-dedupe-makalyn-collapse'
//   '2.3-import-per-project-scope'
//
// shipped_in: short git SHA (or commit message keyword) so the user can
// trace each case to the commit that introduced it.
export const useCases = pgTable(
  'use_cases',
  {
    slug: text('slug').primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),

    // ── Spec (seed-managed, AI authored, NEVER touched by state writes) ──
    groupKey: text('group_key').notNull().default('misc'),       // '1', '2', 'directus-import', ...
    groupLabel: text('group_label').notNull().default(''),
    title: text('title').notNull(),
    priority: text('priority').notNull().default('medium'),       // critical | high | medium | low
    steps: jsonb('steps').notNull().default([]),                  // [{ n, action, url? }]
    expected: text('expected').notNull().default(''),
    shippedIn: text('shipped_in'),                                // commit SHA (short)
    featureRef: text('feature_ref'),                              // '/p/[id]/resources accounts vault'
    tags: jsonb('tags').notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    // ── State (user-managed via UI, seed NEVER overwrites) ──
    status: text('status').notNull().default('pending'),          // pending | wip | pass | fail | needs-fix | blocked | skip
    statusNote: text('status_note'),
    feedback: text('feedback'),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastTestedBy: text('last_tested_by'),
    blockerRef: text('blocker_ref'),

    // ── Fix-tracking (AI-managed, signals to user "re-test now") ──
    // After AI ships a fix that addresses this case's feedback, AI calls
    // markCaseFixed(slug, commitSha) to set these. UI shows a "🔄 Re-test"
    // badge so the user knows new code is live.
    // Cleared automatically when: (a) user marks pass/pending (success — fix
    // confirmed), (b) user adds new feedback with mark-needs-fix (new
    // iteration — old fix superseded).
    fixedIn: text('fixed_in'),
    fixedAt: timestamp('fixed_at', { withTimezone: true }),
    fixNote: text('fix_note'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('use_cases_tenant_idx').on(t.tenantId),
    index('use_cases_group_idx').on(t.groupKey),
    index('use_cases_status_idx').on(t.status),
  ],
);

// ── roadmap_items ───────────────────────────────────────────────
// Roadmap registry. Spec is seed-managed (AI appends new ideas/tasks);
// state (status, notes, started_at, done_at) is user-managed via /roadmap.
//
// Cross-linked to use_cases via use_case_slugs[] — UI computes pass-rate
// per roadmap item so "done = N/N tests pass" is verifiable.
export const roadmapItems = pgTable(
  'roadmap_items',
  {
    slug: text('slug').primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),

    // ── Spec (seed-managed) ──
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('feature'),    // feature | fix | refactor | infra | idea
    phase: text('phase').notNull().default('backlog'),           // '1' | '2' | ... | 'backlog'
    priority: text('priority').notNull().default('medium'),     // critical | high | medium | low
    effort: text('effort').notNull().default('M'),               // XS | S | M | L | XL
    dependsOn: jsonb('depends_on').notNull().default([]),        // slug[]
    shippedIn: text('shipped_in'),                                // commit SHA when done
    featureRef: text('feature_ref'),
    useCaseSlugs: jsonb('use_case_slugs').notNull().default([]), // slugs in use_cases table
    tags: jsonb('tags').notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    // ── State (user-managed) ──
    status: text('status').notNull().default('backlog'),          // backlog | planned | in-progress | review | done | blocked | dropped
    statusNote: text('status_note'),
    blockerRef: text('blocker_ref'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    doneAt: timestamp('done_at', { withTimezone: true }),
    notes: text('notes'),                                          // markdown user notes

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('roadmap_tenant_idx').on(t.tenantId),
    index('roadmap_phase_idx').on(t.phase),
    index('roadmap_status_idx').on(t.status),
  ],
);

// ── ai_suggestions (Phase 10 — AI runtime) ───────────────────────
// Per-project cache của AI-generated suggestions. Generated via OpenAI
// (gpt-4o-mini default) khi user mở Dashboard hoặc click "Refresh".
// TTL ~1h — older cache → regenerate. Manual force regenerate any time.
export const aiSuggestions = pgTable(
  'ai_suggestions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    model: text('model').notNull().default('gpt-4o-mini'),
    suggestions: jsonb('suggestions').notNull().default([]), // [{icon, title, meta, agent}]
    promptHash: text('prompt_hash'),                          // SHA-256 of prompt input — skip regen if unchanged
    inputContext: jsonb('input_context').notNull().default({}), // what we sent to AI (cards count, mode, etc.)
    tokensUsed: integer('tokens_used').notNull().default(0),
    // User feedback per suggestion: { "0": "approved" | "rejected", "1": "rejected", ... }
    // Index = position trong suggestions[]. Missing key = pending (chưa quyết định).
    feedback: jsonb('feedback').notNull().default({}),
  },
  (t) => [
    index('ai_sugg_project_idx').on(t.projectId, t.generatedAt),
  ],
);

// ── media_assets (Phase 8 — Media vault) ─────────────────────────
// Files attached to project: images, videos, audio, docs. URL có thể là
// internal CDN, S3, hoặc external link. `hot=true` đánh dấu asset hay reuse.
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('image'),  // image|video|audio|doc|other
    filename: text('filename').notNull(),
    url: text('url').notNull(),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    durationSec: integer('duration_sec'),
    hot: boolean('hot').notNull().default(false),
    tags: jsonb('tags').notNull().default([]),
    notes: text('notes'),
    source: text('source'),  // 'upload' | 'gen' | 'external'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_assets_tenant_idx').on(t.tenantId),
    index('media_assets_project_idx').on(t.projectId),
    index('media_assets_kind_idx').on(t.kind),
  ],
);

// ── infra_resources (Phase 8 — Infra vault) ──────────────────────
// Proxies, SIM, devices, API keys, domains, servers. SECRET FIELDS không lưu
// plaintext — chỉ metadata (label, provider, status, costs, notes). Khi cần
// secret thực, point qua earns-assets/Directus (lưu encrypted bởi pgcrypto).
export const infraResources = pgTable(
  'infra_resources',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),  // null = shared infra
    kind: text('kind').notNull(),  // proxy|sim|device|api_key|domain|server|other
    label: text('label').notNull(),
    provider: text('provider'),
    status: text('status').notNull().default('active'),  // active|expired|paused|broken
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    costMonthly: integer('cost_monthly').notNull().default(0),  // currency-agnostic; convention VND
    currency: text('currency').notNull().default('VND'),
    meta: jsonb('meta').notNull().default({}),  // {ip,port,user,...} or {imei,carrier,...}
    notes: text('notes'),
    tags: jsonb('tags').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('infra_resources_tenant_idx').on(t.tenantId),
    index('infra_resources_project_idx').on(t.projectId),
    index('infra_resources_kind_idx').on(t.kind),
    index('infra_resources_status_idx').on(t.status),
  ],
);

// ── budget_entries (Phase 8 — Budget vault) ──────────────────────
// Income/expense events. recurringIntervalDays != null → subscription pattern.
// Currency = VND default. amountCents convention: store integer (1000 = 1k VND).
export const budgetEntries = pgTable(
  'budget_entries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('expense'),  // income|expense|recurring
    category: text('category').notNull().default('other'),  // ads|tools|hosting|content|salary|tax|other
    label: text('label').notNull(),
    amountCents: integer('amount_cents').notNull().default(0),
    currency: text('currency').notNull().default('VND'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    recurringIntervalDays: integer('recurring_interval_days'),
    notes: text('notes'),
    tags: jsonb('tags').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('budget_entries_tenant_idx').on(t.tenantId),
    index('budget_entries_project_idx').on(t.projectId),
    index('budget_entries_kind_idx').on(t.kind),
    index('budget_entries_occurred_idx').on(t.occurredAt),
  ],
);

// ── content_pieces (Phase 8 — Content Studio) ───────────────────
// Pieces per project, grouped by channel (fb-post, email, ad, reel, landing,
// dm, twitter-thread, blog, youtube-script). bodyMd = source markdown,
// channel-specific render derived bằng preview component. AI co-pilot có thể
// fill aiNotes (3-5 bullets validate hook/tone/CTA).
export const contentPieces = pgTable(
  'content_pieces',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    channel: text('channel').notNull().default('fb-post'),
    tribeSlug: text('tribe_slug'),         // optional FK-by-slug to tribes table
    persona: text('persona'),              // free-text persona/handle
    subject: text('subject'),              // for email/post hook
    bodyMd: text('body_md').notNull().default(''),
    status: text('status').notNull().default('draft'),  // draft|approved|scheduled|published|archived
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishUrl: text('publish_url'),
    aiNotes: jsonb('ai_notes').notNull().default([]),
    tags: jsonb('tags').notNull().default([]),
    metrics: jsonb('metrics').notNull().default({}),  // {reach, react, comment, share, ctr}
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('content_pieces_project_slug_uniq').on(t.projectId, t.slug),
    index('content_pieces_tenant_idx').on(t.tenantId),
    index('content_pieces_channel_idx').on(t.channel),
    index('content_pieces_status_idx').on(t.status),
  ],
);

// ── Phase 9 Foundations: orchestrator infrastructure ────────────

// agent_runs — audit log mọi AI/agent execution. Foundation cho:
// - cost analysis (sum cost_usd_cents per agent_kind / project / day)
// - debugging (replay input/output)
// - peer review (link review run to original via parent_run_id)
// - dependency resolution (playbook step ref output qua run id)
export const agentRuns = pgTable(
  'agent_runs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    cardId: integer('card_id'),                                          // optional link to cards.id
    agentKind: text('agent_kind').notNull(),                             // gpt-4o-mini | claude-haiku-4-5 | claude-code | human | gpt-4o | gemini-2.5-flash
    agentRef: text('agent_ref'),                                         // 'RES-04' (specific agent within squad)
    squadId: integer('squad_id').references(() => squads.id, { onDelete: 'set null' }),
    playbookSlug: text('playbook_slug'),                                 // if part of playbook execution
    playbookStepId: text('playbook_step_id'),                            // step within playbook
    parentRunId: integer('parent_run_id'),                               // chained run (e.g., peer review of another run)
    status: text('status').notNull().default('pending'),                 // pending | running | completed | failed | timed_out | rejected
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    timeoutAt: timestamp('timeout_at', { withTimezone: true }),          // for timeout enforcement
    durationMs: integer('duration_ms'),
    input: jsonb('input').notNull().default({}),                         // task input
    output: jsonb('output').notNull().default({}),                       // structured output (Zod-validated)
    artifacts: jsonb('artifacts').notNull().default([]),                 // [{path, type, hash, size}]
    toolsUsed: jsonb('tools_used').notNull().default([]),                // [{tool_id, input, output, duration_ms}]
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    costUsdCents: integer('cost_usd_cents').notNull().default(0),        // store as cents avoid float
    error: text('error'),
    peerReview: jsonb('peer_review'),                                    // {model, decision, reasoning, cost_cents}
    idempotencyKey: text('idempotency_key'),                             // prevent dup side-effects
    attempt: integer('attempt').notNull().default(1),                    // for retry tracking
    confidence: integer('confidence'),                                   // 0-100 (-1 = unknown)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_runs_tenant_idx').on(t.tenantId),
    index('agent_runs_project_idx').on(t.projectId),
    index('agent_runs_card_idx').on(t.cardId),
    index('agent_runs_kind_idx').on(t.agentKind),
    index('agent_runs_status_idx').on(t.status),
    index('agent_runs_created_idx').on(t.createdAt),
    index('agent_runs_idempotency_idx').on(t.idempotencyKey),
  ],
);

// human_tasks — queue cho bot-blocked platforms (FB/IG/TikTok DM).
// AI prep payload (caption + image + hashtags + best-time), human nhận task
// qua /inbox, đăng, upload screenshot, AI verify URL → resume parent flow.
export const humanTasks = pgTable(
  'human_tasks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    cardId: integer('card_id'),                                          // parent card if any
    parentRunId: integer('parent_run_id'),                               // agent_runs that queued this
    title: text('title').notNull(),
    instructions: text('instructions').notNull().default(''),            // 1-3 sentence what user must do
    prepPayload: jsonb('prep_payload').notNull().default({}),            // {caption, image_urls, hashtags, best_time_at}
    platformKey: text('platform_key'),                                   // fb | ig | tiktok-dm | etc.
    accountId: integer('account_id').references(() => platformAccounts.id, { onDelete: 'set null' }),
    slaDueAt: timestamp('sla_due_at', { withTimezone: true }),
    status: text('status').notNull().default('pending'),                 // pending | claimed | in_progress | completed | verified | failed | cancelled
    claimedBy: text('claimed_by'),                                       // user identifier (email or 'self')
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    publishUrl: text('publish_url'),                                     // URL after human posted (for AI verify)
    screenshotUrl: text('screenshot_url'),                               // evidence upload
    feedbackType: text('feedback_type'),                                 // 'success' | 'revise' | 'error' | 'more-info' — drives downstream actions
    feedbackText: text('feedback_text'),                                 // free-form feedback từ human
    verifyResult: jsonb('verify_result'),                                // AI verification output
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    escalationCount: integer('escalation_count').notNull().default(0),
    notes: text('notes'),
    // Phase 14 (migration 0032): assignment to specific team user
    assignedUserId: bigint('assigned_user_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('human_tasks_tenant_idx').on(t.tenantId),
    index('human_tasks_project_idx').on(t.projectId),
    index('human_tasks_status_idx').on(t.status),
    index('human_tasks_sla_idx').on(t.slaDueAt),
    index('human_tasks_assigned_idx').on(t.assignedUserId, t.status),
  ],
);

// playbooks — DAG steps cho multi-step recurring flows (e.g., "launch PH" 14-step).
// Replace flat cards với typed dependencies + retry policy.
export const playbooks = pgTable(
  'playbooks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),  // null = shared template
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    triggerKind: text('trigger_kind').notNull().default('manual'),       // manual | schedule | event
    triggerConfig: jsonb('trigger_config').notNull().default({}),        // cron expr or event spec
    steps: jsonb('steps').notNull().default([]),                         // [{id, action, agent_ref, agent_kind, trust_required, depends_on, input_mapping, retry, timeout_sec}]
    status: text('status').notNull().default('draft'),                   // draft | active | paused | archived
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('playbooks_tenant_slug_uniq').on(t.tenantId, t.slug),
    index('playbooks_status_idx').on(t.status),
  ],
);

// users + members — RBAC sketch. Solo MVP single admin, schema sẵn cho team scale.
// auth flow phase sau (likely OAuth + session cookies).
export const users = pgTable(
  'users',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    avatarUrl: text('avatar_url'),
    authKind: text('auth_kind').notNull().default('session'),            // 'session' | 'api_key' | 'oauth'
    apiKeyHash: text('api_key_hash'),                                    // SHA256 of key (for API auth tier)
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_tenant_email_uniq').on(t.tenantId, t.email),
    index('users_tenant_idx').on(t.tenantId),
  ],
);

export const members = pgTable(
  'members',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    userId: integer('user_id').notNull(),                                // references users.id (no FK to allow tenant isolation)
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),  // null = tenant-wide
    role: text('role').notNull().default('admin'),                       // admin | operator | viewer
    // Phase 14 (migration 0032): team management
    displayName: text('display_name'),                                   // public-facing name in the team
    specialty: text('specialty'),                                        // writer | community | designer | video | outreach | analytics | ops | founder
    bio: text('bio'),                                                    // short bio for AI persona/voice
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('members_user_project_uniq').on(t.userId, t.projectId),
    index('members_tenant_idx').on(t.tenantId),
  ],
);

// daily_spend_caps — per project (or global khi project_id NULL) per day.
// Aggregator job sums agent_runs.cost_usd_cents into spent_usd_cents.
// Status flips 'exceeded' → worker auto-pauses agents trên project đó.
export const dailySpendCaps = pgTable(
  'daily_spend_caps',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),                                          // 'YYYY-MM-DD' (date as text for portability)
    capUsdCents: integer('cap_usd_cents').notNull().default(100),        // $1 default
    spentUsdCents: integer('spent_usd_cents').notNull().default(0),
    status: text('status').notNull().default('active'),                  // active | paused | exceeded
    autoPausedAt: timestamp('auto_paused_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('daily_spend_caps_uniq').on(t.tenantId, t.projectId, t.day),
    index('daily_spend_caps_day_idx').on(t.day),
    index('daily_spend_caps_status_idx').on(t.status),
  ],
);

// ── library_tools (Phase 8 — shared catalog) ─────────────────────
// Tools/integrations available to AI agents. Squad.config.tools refs by id.
// Seed initial từ lib/tools-library.ts; user CRUD qua /library page.
export const libraryTools = pgTable(
  'library_tools',
  {
    id: text('id').primaryKey(),                         // 'reddit-script'
    tenantId: text('tenant_id').notNull().default('self'),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('data'),  // platform|data|ai|storage|comms|analytics
    icon: text('icon').notNull().default('🔧'),
    requiresEnv: text('requires_env'),                     // env var dependency, e.g. 'OPENAI_API_KEY'
    // status:
    //   'mock'       — chỉ là metadata trong catalog, chưa wire executable code
    //   'planned'    — wire-up đang lên kế hoạch (phase 10 Agent runtime)
    //   'integrated' — đã có function/MCP server hoạt động (Squad có thể call)
    status: text('status').notNull().default('mock'),
    sourceUrl: text('source_url'),                         // optional: API docs / repo
    // Phase 12 tool runtime: when non-null, points to executable module path
    // (e.g. 'toolkits/research'). Registry maps tool.id → real function.
    runtimeModule: text('runtime_module'),
    // Side-effect classification cho gate enforcement:
    //   'read'    — query/fetch only (web search, DB read).
    //   'write'   — create/update (post tweet, save knowledge, send DM).
    //   'destroy' — delete/charge (delete account, charge card).
    sideEffect: text('side_effect').notNull().default('read'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('library_tools_tenant_idx').on(t.tenantId),
    index('library_tools_category_idx').on(t.category),
  ],
);

// ── skill_snippets ───────────────────────────────────────────────
// Reusable markdown skill descriptions. Squad.config.skillsMd có thể reference.
// Phase 1: standalone library; phase 2: link from squad (FK).
export const skillSnippets = pgTable(
  'skill_snippets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),              // markdown
    tags: jsonb('tags').notNull().default([]),
    source: text('source'),                                // 'awesome-chatgpt-prompts', 'anthropic-cookbook', 'curated'...
    sourceUrl: text('source_url'),                         // direct link nếu có
    license: text('license'),                              // 'CC0', 'MIT', 'curated' (own work)...
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('skill_snippets_tenant_slug_uniq').on(t.tenantId, t.slug),
    index('skill_snippets_tenant_idx').on(t.tenantId),
  ],
);

// Re-export helper for convenience.
export const schema = { modes, projects, squads, agents, cards, alerts, feedEvents, platformTechnologies, platforms, platformAccounts, projectAccounts, accountGrants, proxies, browserProfiles, useCases, roadmapItems, tribes, habitats, habitatTribes, communityBriefs, seedingSchedules, knowledgeItems, selectorOverrides, extCallLog, contacts, aiSuggestions, libraryTools, skillSnippets, mediaAssets, infraResources, budgetEntries, contentPieces, agentRuns, humanTasks, playbooks, users, members, dailySpendCaps };
