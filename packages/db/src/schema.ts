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
  smallint,
  boolean,
  jsonb,
  timestamp,
  bigserial,
  uniqueIndex,
  index,
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
    title: text('title').notNull(),
    squadKey: text('squad_key').notNull(),                  // FK-by-key into squads.squadKey (denorm for speed)
    level: smallint('level').notNull().default(2),          // 1-4 trust level
    money: text('money'),                                   // free-form: '+est. 18tr/tháng', '-2.4tr/ngày'
    due: text('due').notNull().default('—'),
    urgent: boolean('urgent').notNull().default(false),
    tags: jsonb('tags').notNull().default([]),
    agentRef: text('agent_ref'),
    body: text('body'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cards_project_ref_uniq').on(t.projectId, t.cardRef),
    index('cards_tenant_idx').on(t.tenantId),
    index('cards_project_col_idx').on(t.projectId, t.col),
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
    priority: text('priority').notNull().default('medium'), // 'critical' | 'high' | 'medium'
    fallbackKeys: jsonb('fallback_keys').notNull().default([]),
    iconSlug: text('icon_slug').notNull().default(''),
    imageSpecs: jsonb('image_specs').notNull().default([]),
    checklist: jsonb('checklist').notNull().default([]),
    autoCheck: boolean('auto_check').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('platforms_tenant_idx').on(t.tenantId), index('platforms_priority_idx').on(t.priority)],
);

// ── platform_accounts ────────────────────────────────────────────
// Per-project accounts on platforms (Product Hunt, HackerNews, Reddit, ...).
// status state machine: todo → creating → warming → active (linear)
// side-states: limited / blocked / banned (reachable from any).
// warmup_checklist mirrors the platforms.checklist shape, with per-item progress.
export const platformAccounts = pgTable(
  'platform_accounts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: text('tenant_id').notNull().default('self'),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
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
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('accounts_tenant_idx').on(t.tenantId),
    index('accounts_project_idx').on(t.projectId),
    index('accounts_platform_idx').on(t.platformKey),
    index('accounts_status_idx').on(t.projectId, t.status),
    uniqueIndex('accounts_proj_platform_handle_uniq').on(t.projectId, t.platformKey, t.handle),
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
    members: integer('members').notNull().default(0),
    activity: text('activity').notNull().default(''),       // free-form: 'high', '120 posts/d'
    scrapeFrequency: text('scrape_frequency').notNull().default('manual'), // live|manual|weekly|comments
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    health: text('health').notNull().default('ok'),        // ok|warn|bad
    importedFrom: text('imported_from'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('habitats_tenant_idx').on(t.tenantId),
    index('habitats_tribe_idx').on(t.tribeId),
    index('habitats_project_idx').on(t.projectId),
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
  },
  (t) => [
    index('ai_sugg_project_idx').on(t.projectId, t.generatedAt),
  ],
);

// Re-export helper for convenience.
export const schema = { modes, projects, squads, agents, cards, alerts, feedEvents, platforms, platformAccounts, useCases, roadmapItems, tribes, habitats, knowledgeItems, contacts, aiSuggestions };
