// Seed runs in two phases:
//
// 1. SPEC-only (always idempotent, safe every deploy):
//    modes + platforms + use_cases. Updates spec columns; user-managed
//    state (use_cases.status/feedback) is NEVER overwritten.
//
// 2. DESTRUCTIVE demo content (only when MOS2_AUTO_SEED=1):
//    projects + per-project squads/cards/alerts/feed. WIPES then RE-INSERTS,
//    so any user edits on demo projects (drag, approve, edits) get lost.
//    Set the env flag deliberately for first deploy or full reset.
//
// Run: npm run db:seed (spec by default; destructive only with env flag)

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { modes, projects, squads, cards, alerts, feedEvents, platformTechnologies, platforms, useCases, roadmapItems } from './schema';

import { MODES_BASE } from './seed-data/modes-base';
import { MODES_EXTRA } from './seed-data/modes-extra';
import { PROJECTS_SEED } from './seed-data/projects';
import { TECHNOLOGIES } from './seed-data/technologies';
import { PLATFORMS } from './seed-data/platforms';
import { USE_CASES } from './seed-data/use-cases';
import { ROADMAP_ITEMS } from './seed-data/roadmap';

const db = getDb();
if (!db) {
  console.error('DATABASE_URL not set — refusing to seed.');
  process.exit(1);
}

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const DESTRUCTIVE = process.env.MOS2_AUTO_SEED === '1';

const ALL_MODES = { ...MODES_BASE, ...MODES_EXTRA };

console.log(`[mos2/db:seed] Tenant=${TENANT}, destructive=${DESTRUCTIVE}`);
console.log(`[mos2/db:seed] Modes: ${Object.keys(ALL_MODES).length}, Platforms: ${PLATFORMS.length}, Use cases: ${USE_CASES.length}`);
if (DESTRUCTIVE) console.log(`[mos2/db:seed] Projects: ${PROJECTS_SEED.length} (will WIPE per-project squads/cards/alerts/feed)`);

// ── 0a. Seed platform technologies ────────────────────────────
for (const t of TECHNOLOGIES) {
  await db
    .insert(platformTechnologies)
    .values({ key: t.key, label: t.label, description: t.description, signupFields: t.signupFields, notes: t.notes ?? null })
    .onConflictDoUpdate({
      target: platformTechnologies.key,
      set: { label: t.label, description: t.description, signupFields: t.signupFields, notes: t.notes ?? null, updatedAt: new Date() },
    });
}
console.log(`[mos2/db:seed] ✓ Platform technologies upserted (${TECHNOLOGIES.length})`);

// ── 0b. Seed platforms catalog ──────────────────────────────
for (const p of PLATFORMS) {
  const row = {
    key: p.key,
    tenantId: TENANT,
    label: p.label,
    signupUrl: p.signupUrl,
    postUrl: p.postUrl ?? null,
    priority: p.priority,
    fallbackKeys: p.fallbackKeys,
    iconSlug: p.iconSlug,
    imageSpecs: p.imageSpecs,
    checklist: p.checklist,
    autoCheck: p.autoCheck,
  };
  await db
    .insert(platforms)
    .values(row)
    .onConflictDoUpdate({
      target: platforms.key,
      set: { ...row, updatedAt: new Date() },
    });
}
console.log(`[mos2/db:seed] ✓ Platforms catalog upserted (${PLATFORMS.length})`);

// ── 0b. Seed use cases (SPEC ONLY — never touches user-managed state) ──
// Upsert spec columns; on conflict, set ONLY spec fields and bump updated_at.
// status / status_note / feedback / last_tested_at / last_tested_by /
// blocker_ref / archived_at are owned by the user via /tests UI and must
// never be overwritten here, even if the row already existed.
for (const uc of USE_CASES) {
  const specRow = {
    slug: uc.slug,
    tenantId: TENANT,
    groupKey: uc.groupKey,
    groupLabel: uc.groupLabel,
    title: uc.title,
    priority: uc.priority,
    steps: uc.steps,
    expected: uc.expected,
    shippedIn: uc.shippedIn ?? null,
    featureRef: uc.featureRef ?? null,
    tags: uc.tags ?? [],
    sortOrder: uc.sortOrder ?? 0,
  };
  await db
    .insert(useCases)
    .values(specRow)
    .onConflictDoUpdate({
      target: useCases.slug,
      set: {
        groupKey: specRow.groupKey,
        groupLabel: specRow.groupLabel,
        title: specRow.title,
        priority: specRow.priority,
        steps: specRow.steps,
        expected: specRow.expected,
        shippedIn: specRow.shippedIn,
        featureRef: specRow.featureRef,
        tags: specRow.tags,
        sortOrder: specRow.sortOrder,
        updatedAt: new Date(),
      },
    });
}
console.log(`[mos2/db:seed] ✓ Use cases upserted (${USE_CASES.length}, state preserved)`);

// ── 0c. Seed roadmap items (SPEC ONLY) ────────────────────────
// Same pattern: spec upserted, user state preserved. initialStatus only used
// on first INSERT (when row doesn't exist yet); existing rows keep their status.
for (const item of ROADMAP_ITEMS) {
  const insertRow = {
    slug: item.slug,
    tenantId: TENANT,
    title: item.title,
    description: item.description,
    category: item.category,
    phase: item.phase,
    priority: item.priority,
    effort: item.effort,
    dependsOn: item.dependsOn ?? [],
    shippedIn: item.shippedIn ?? null,
    featureRef: item.featureRef ?? null,
    useCaseSlugs: item.useCaseSlugs ?? [],
    tags: item.tags ?? [],
    sortOrder: item.sortOrder ?? 0,
    status: item.initialStatus ?? 'backlog',
    doneAt: item.initialStatus === 'done' ? new Date() : null,
  };
  await db
    .insert(roadmapItems)
    .values(insertRow)
    .onConflictDoUpdate({
      target: roadmapItems.slug,
      // Update spec only — preserve user state.
      set: {
        title: insertRow.title,
        description: insertRow.description,
        category: insertRow.category,
        phase: insertRow.phase,
        priority: insertRow.priority,
        effort: insertRow.effort,
        dependsOn: insertRow.dependsOn,
        shippedIn: insertRow.shippedIn,
        featureRef: insertRow.featureRef,
        useCaseSlugs: insertRow.useCaseSlugs,
        tags: insertRow.tags,
        sortOrder: insertRow.sortOrder,
        updatedAt: new Date(),
      },
    });
}
console.log(`[mos2/db:seed] ✓ Roadmap items upserted (${ROADMAP_ITEMS.length}, state preserved)`);

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

if (!DESTRUCTIVE) {
  console.log('[mos2/db:seed] ✓ Spec done. Skipping demo content (set MOS2_AUTO_SEED=1 to wipe+reseed projects).');
  process.exit(0);
}

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
    isDemo: p.isDemo ?? false,
    aiEnabled: p.aiEnabled ?? true,
    website: p.website ?? '',
    oneLiner: p.oneLiner ?? '',
    bio: p.bio ?? '',
    persona: p.persona ?? '',
    hashtags: p.hashtags ?? '',
  };
  // Brand fields (website/oneLiner/bio/persona/hashtags) are USER-MANAGED via
  // /p/[id]/settings. Seed inserts defaults on first INSERT only — re-seed
  // never overwrites them. Spec fields (name/mode/budget/etc.) still upsert.
  // User-managed columns excluded từ upsert update — preserve edits qua re-seed.
  // Brand fields: user nhập trong Settings/Brand panel.
  // aiEnabled: user toggle trong Settings/AI panel.
  const { website: _w, oneLiner: _o, bio: _b, persona: _p, hashtags: _h, aiEnabled: _ae, ...specOnly } = row;
  await db
    .insert(projects)
    .values(row)
    .onConflictDoUpdate({
      target: projects.id,
      set: { ...specOnly, updatedAt: new Date() },
    });
}
console.log(`[mos2/db:seed] ✓ Projects upserted (brand fields preserved on existing rows)`);

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
