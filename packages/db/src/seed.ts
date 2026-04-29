// Seed: 14 modes + 10 mock projects + Orit + Astrolas + cards/alerts/feed/squads.
// Idempotent: uses INSERT ... ON CONFLICT DO UPDATE for slugs.
//
// Run: npm run db:seed

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { modes, projects, squads, cards, alerts, feedEvents } from './schema';

import { MODES_BASE } from './seed-data/modes-base';
import { MODES_EXTRA } from './seed-data/modes-extra';
import { PROJECTS_SEED } from './seed-data/projects';

const db = getDb();
if (!db) {
  console.error('DATABASE_URL not set — refusing to seed.');
  process.exit(1);
}

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

const ALL_MODES = { ...MODES_BASE, ...MODES_EXTRA };

console.log(`[mos2/db:seed] Tenant=${TENANT}`);
console.log(`[mos2/db:seed] Modes: ${Object.keys(ALL_MODES).length}, Projects: ${PROJECTS_SEED.length}`);

// ── 1. Seed modes ─────────────────────────────────────────────
for (const [id, m] of Object.entries(ALL_MODES)) {
  const payload = {
    kpis: m.kpis ?? [],
    columns: m.columns ?? [],
    revChart: m.revChart ?? null,
    revData: m.revData ?? [],
    topListTitle: m.topListTitle ?? null,
    topListSub: m.topListSub ?? null,
    topListCols: m.topListCols ?? [],
    topList: m.topList ?? [],
    suggestions: m.suggestions ?? [],
    extraTab: m.extraTab ?? null,
  };
  const row = {
    id,
    tenantId: TENANT,
    label: m.label,
    sub: m.sub ?? '',
    accent: m.accent ?? 'cyan',
    pageTitle: m.pageTitle,
    pageSub: m.pageSub ?? null,
    boardTitle: m.boardTitle,
    squadsTitle: m.squadsTitle,
    livePill: m.livePill ?? null,
    statusSpend: m.statusbar?.spend ?? null,
    statusSpendVal: m.statusbar?.spendVal ?? null,
    statusSpendCap: m.statusbar?.spendCap ?? null,
    statusQueue: m.statusbar?.queue ?? null,
    statusTasksMin: m.statusbar?.tasksMin ?? null,
    killCap: m.killBudget?.cap ?? null,
    killUsed: m.killBudget?.used ?? null,
    payload,
  };
  await db
    .insert(modes)
    .values(row)
    .onConflictDoUpdate({
      target: modes.id,
      set: { ...row, updatedAt: new Date() },
    });
}
console.log(`[mos2/db:seed] ✓ Modes upserted`);

// ── 2. Seed projects ──────────────────────────────────────────
for (const p of PROJECTS_SEED) {
  const row = {
    id: p.id,
    tenantId: TENANT,
    name: p.name,
    emoji: p.emoji ?? '📦',
    modeId: p.mode,
    agentsCore: p.agents?.core ?? 0,
    agentsShared: p.agents?.shared ?? 0,
    budget: p.budget ?? 0,
    health: p.health ?? 80,
    revenue: p.revenue ?? '—',
    kpi: p.kpi ?? '',
    alerts: p.alerts ?? 0,
    color: p.color ?? '#00e5ff',
  };
  await db
    .insert(projects)
    .values(row)
    .onConflictDoUpdate({
      target: projects.id,
      set: { ...row, updatedAt: new Date() },
    });
}
console.log(`[mos2/db:seed] ✓ Projects upserted`);

// ── 3. Seed squads / cards / alerts / feed for each project ──
// Strategy: each project's mode owns the canonical squad/card/alert/feed shape.
// We materialize them per-project (so editing one project's squad doesn't ripple).
for (const p of PROJECTS_SEED) {
  const m = ALL_MODES[p.mode];
  if (!m) {
    console.warn(`[mos2/db:seed] ! project ${p.id} → mode ${p.mode} missing, skipping`);
    continue;
  }

  // Wipe project-scoped rows first (clean re-seed). Cascade via FK.
  await db.delete(squads).where(eq(squads.projectId, p.id));
  await db.delete(cards).where(eq(cards.projectId, p.id));
  await db.delete(alerts).where(eq(alerts.projectId, p.id));
  await db.delete(feedEvents).where(eq(feedEvents.projectId, p.id));

  if (p.blank) {
    console.log(`[mos2/db:seed] ↺ ${p.id} (blank — skipping squads/cards/alerts/feed)`);
    continue;
  }

  // Squads
  for (const s of m.squads ?? []) {
    await db.insert(squads).values({
      tenantId: TENANT,
      projectId: p.id,
      squadKey: s.id,
      name: s.name,
      vi: s.vi ?? '',
      icon: s.icon ?? '🤖',
      agents: s.agents ?? 0,
      active: s.active ?? 0,
      color: s.color ?? '#00e5ff',
      descText: s.desc ?? '',
      health: s.health ?? 'ok',
    });
  }

  // Cards
  for (const c of m.cards ?? []) {
    await db.insert(cards).values({
      tenantId: TENANT,
      projectId: p.id,
      cardRef: c.id,
      col: c.col,
      title: c.title,
      squadKey: c.squad,
      level: c.level ?? 2,
      money: c.money ?? null,
      due: c.due ?? '—',
      urgent: !!c.urgent,
      tags: c.tags ?? [],
      agentRef: c.agent ?? null,
      body: c.body ?? null,
    });
  }

  // Alerts
  for (const a of m.alerts ?? []) {
    await db.insert(alerts).values({
      tenantId: TENANT,
      projectId: p.id,
      alertRef: a.id,
      tone: a.tone ?? 'warn',
      title: a.title,
      body: a.body ?? '',
      timeLabel: a.time ?? '',
      tags: a.tags ?? [],
    });
  }

  // Feed events
  for (const f of m.feed ?? []) {
    await db.insert(feedEvents).values({
      tenantId: TENANT,
      projectId: p.id,
      timeLabel: f.t,
      agentRef: f.agent,
      lvl: f.lvl ?? 1,
      action: f.action,
      target: f.target ?? '',
      isNew: !!f.new,
    });
  }
}
console.log(`[mos2/db:seed] ✓ Per-project squads/cards/alerts/feed seeded`);

console.log('[mos2/db:seed] Done.');
process.exit(0);
