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

// Re-export helper for convenience.
export const schema = { modes, projects, squads, agents, cards, alerts, feedEvents };
