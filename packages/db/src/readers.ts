// Read-side query helpers. Returned shape mirrors apps/web/src/lib/mock/types.ts
// so the web app can swap mock <-> DB transparently via lib/data.ts.

import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { getDb } from './client';
import { alerts, cards, feedEvents, modes, projects, squads, platforms, platformAccounts, projectAccounts, useCases, roadmapItems, tribes, habitats, knowledgeItems, contacts, mediaAssets, infraResources, budgetEntries, contentPieces, agentRuns, humanTasks, playbooks, members, dailySpendCaps, strategyTests, strategyTestAssets, strategyForward, strategyTrades } from './schema';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export async function listStrategyTests(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db.select().from(strategyTests).where(eq(strategyTests.projectId, projectId)).orderBy(asc(strategyTests.id));
}

export async function listStrategyTestAssets() {
  const db = getDb();
  if (!db) return null;
  return db.select().from(strategyTestAssets).orderBy(asc(strategyTestAssets.id));
}

export async function listStrategyForward() {
  const db = getDb();
  if (!db) return null;
  return db.select().from(strategyForward).orderBy(asc(strategyForward.id));
}

export async function listStrategyTrades() {
  const db = getDb();
  if (!db) return null;
  return db.select().from(strategyTrades).orderBy(asc(strategyTrades.entryTime));
}

// "now" in the broker's clock as epoch-ms, in the SAME basis strategy_trades.entry_time is stored (naked broker time
// read as UTC). Lets the UI compute live hold for OPEN MT5 positions without the browser-tz skew. = server_time + age.
export async function getBrokerNowMs(): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  const r = await db.execute(sql`
    SELECT (extract(epoch from ((server_time::timestamp) AT TIME ZONE 'UTC')) + extract(epoch from (now() - seen_at))) * 1000 AS ms
    FROM ea_heartbeat WHERE source = 'strategylab' LIMIT 1`);
  const row = (r as { rows?: Array<{ ms: number | string }> }).rows?.[0] ?? (r as unknown as Array<{ ms: number | string }>)[0];
  const ms = row?.ms;
  return ms == null ? null : Number(ms);
}

export async function listProjects() {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, TENANT), isNull(projects.archivedAt)))
    .orderBy(asc(projects.id));
}

export async function getProjectById(id: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, TENANT), eq(projects.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getModeById(id: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(modes)
    .where(and(eq(modes.tenantId, TENANT), eq(modes.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAllModes() {
  const db = getDb();
  if (!db) return null;
  return db
    .select({ id: modes.id, label: modes.label, sub: modes.sub, accent: modes.accent })
    .from(modes)
    .where(eq(modes.tenantId, TENANT))
    .orderBy(asc(modes.label));
}

export async function listSquadsByProject(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(squads)
    .where(and(eq(squads.tenantId, TENANT), eq(squads.projectId, projectId)))
    .orderBy(asc(squads.id));
}

export async function listCardsByProject(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.tenantId, TENANT), eq(cards.projectId, projectId), isNull(cards.archivedAt)))
    .orderBy(asc(cards.id));
}

export async function listAlertsByProject(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(alerts)
    .where(and(eq(alerts.tenantId, TENANT), eq(alerts.projectId, projectId), isNull(alerts.resolvedAt)))
    .orderBy(desc(alerts.createdAt));
}

export async function listRecentFeed(projectId: string, limit = 20) {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(feedEvents)
    .where(and(eq(feedEvents.tenantId, TENANT), eq(feedEvents.projectId, projectId)))
    .orderBy(desc(feedEvents.occurredAt))
    .limit(limit);
}

// Used by Portfolio overview cards: aggregate health + alerts count.
export async function listProjectsWithMode() {
  const db = getDb();
  if (!db) return null;
  return db
    .select({
      project: projects,
      mode: modes,
    })
    .from(projects)
    .leftJoin(modes, eq(projects.modeId, modes.id))
    .where(and(eq(projects.tenantId, TENANT), isNull(projects.archivedAt)))
    .orderBy(asc(projects.id));
}

// ── Platforms catalog ──────────────────────────────────────────
export async function listAllPlatforms() {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(platforms)
    .where(eq(platforms.tenantId, TENANT))
    .orderBy(asc(platforms.priority), asc(platforms.label));
}

export async function getPlatform(key: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db.select().from(platforms).where(eq(platforms.key, key)).limit(1);
  return rows[0] ?? null;
}

// ── Platform accounts ──────────────────────────────────────────
// JOIN qua project_accounts để cover cả accounts share từ project khác.
// Backfill 0037 đảm bảo mọi account legacy đều có pivot row.
export async function listAccountsByProject(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db
    .select({
      // platformAccounts fields
      id: platformAccounts.id,
      tenantId: platformAccounts.tenantId,
      projectId: platformAccounts.projectId,
      platformKey: platformAccounts.platformKey,
      handle: platformAccounts.handle,
      email: platformAccounts.email,
      status: platformAccounts.status,
      authMethod: platformAccounts.authMethod,
      has2fa: platformAccounts.has2fa,
      lastVerifiedAt: platformAccounts.lastVerifiedAt,
      recoveryInfo: platformAccounts.recoveryInfo,
      apiTokenEnc: platformAccounts.apiTokenEnc,
      monthlyCost: platformAccounts.monthlyCost,
      collectStats: platformAccounts.collectStats,
      blockReason: platformAccounts.blockReason,
      notes: platformAccounts.notes,
      tags: platformAccounts.tags,
      warmupChecklist: platformAccounts.warmupChecklist,
      cookieSessionNeeded: platformAccounts.cookieSessionNeeded,
      lastUsedAt: platformAccounts.lastUsedAt,
      sortOrder: platformAccounts.sortOrder,
      environment: platformAccounts.environment,
      proxyId: platformAccounts.proxyId,
      browserProfileId: platformAccounts.browserProfileId,
      ownerUserId: platformAccounts.ownerUserId,
      persona: platformAccounts.persona,
      createdAt: platformAccounts.createdAt,
      updatedAt: platformAccounts.updatedAt,
      // pivot meta (project's view of this account)
      shareRole: projectAccounts.role,
      shareContentRatio: projectAccounts.contentRatio,
    })
    .from(platformAccounts)
    .innerJoin(projectAccounts, eq(projectAccounts.accountId, platformAccounts.id))
    .where(and(eq(platformAccounts.tenantId, TENANT), eq(projectAccounts.projectId, projectId)))
    .orderBy(asc(platformAccounts.sortOrder), asc(platformAccounts.id));
}

// Account "mồ côi" — có row nhưng KHÔNG có junction project_accounts nào → vô hình
// trên mọi dashboard project-scoped. Inbox /unmapped để gán project.
export async function listUnmappedAccounts() {
  const db = getDb();
  if (!db) return null;
  return db
    .select({
      id: platformAccounts.id,
      platformKey: platformAccounts.platformKey,
      handle: platformAccounts.handle,
      email: platformAccounts.email,
      status: platformAccounts.status,
      createdAt: platformAccounts.createdAt,
    })
    .from(platformAccounts)
    .leftJoin(projectAccounts, eq(projectAccounts.accountId, platformAccounts.id))
    .where(and(eq(platformAccounts.tenantId, TENANT), isNull(projectAccounts.accountId)))
    .orderBy(desc(platformAccounts.createdAt));
}

// ── Use cases ──────────────────────────────────────────────────
export async function listAllUseCases() {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(useCases)
    .where(and(eq(useCases.tenantId, TENANT), isNull(useCases.archivedAt)))
    .orderBy(asc(useCases.groupKey), asc(useCases.sortOrder), asc(useCases.slug));
}

// ── Tribes / Habitats / Knowledge / Contacts (phase 8 vaults) ──
export async function listTribesByProject(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(tribes)
    .where(and(eq(tribes.tenantId, TENANT), eq(tribes.projectId, projectId)))
    .orderBy(asc(tribes.name));
}

export async function listHabitatsByProject(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(habitats)
    .where(and(eq(habitats.tenantId, TENANT), eq(habitats.projectId, projectId)))
    .orderBy(desc(habitats.members));
}

export async function listKnowledgeByProject(projectId: string | null) {
  const db = getDb();
  if (!db) return null;
  // null projectId = portfolio-wide
  const cond = projectId === null
    ? and(eq(knowledgeItems.tenantId, TENANT), isNull(knowledgeItems.projectId))
    : and(eq(knowledgeItems.tenantId, TENANT), eq(knowledgeItems.projectId, projectId));
  return db.select().from(knowledgeItems).where(cond).orderBy(desc(knowledgeItems.updatedAt));
}

export async function listAllKnowledge(projectId?: string) {
  // Includes both project-specific AND portfolio-wide (project_id IS NULL).
  const db = getDb();
  if (!db) return null;
  if (!projectId) {
    return db.select().from(knowledgeItems).where(eq(knowledgeItems.tenantId, TENANT)).orderBy(desc(knowledgeItems.updatedAt));
  }
  return db
    .select()
    .from(knowledgeItems)
    .where(and(
      eq(knowledgeItems.tenantId, TENANT),
      or(eq(knowledgeItems.projectId, projectId), isNull(knowledgeItems.projectId)),
    ))
    .orderBy(desc(knowledgeItems.updatedAt));
}

export async function listContactsByProject(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(contacts)
    .where(and(eq(contacts.tenantId, TENANT), eq(contacts.projectId, projectId)))
    .orderBy(desc(contacts.lastTouchedAt));
}

export async function listAllContacts(projectId?: string) {
  const db = getDb();
  if (!db) return null;
  if (!projectId) {
    return db.select().from(contacts).where(eq(contacts.tenantId, TENANT)).orderBy(desc(contacts.lastTouchedAt));
  }
  return db
    .select()
    .from(contacts)
    .where(and(
      eq(contacts.tenantId, TENANT),
      or(eq(contacts.projectId, projectId), isNull(contacts.projectId)),
    ))
    .orderBy(desc(contacts.lastTouchedAt));
}

// ── Media / Infra / Budget vaults ──────────────────────────
// Convention: include rows với project_id IS NULL (shared portfolio assets) khi
// có projectId — same pattern as contacts/knowledge.
export async function listMediaAssets(projectId?: string) {
  const db = getDb();
  if (!db) return null;
  if (!projectId) {
    return db.select().from(mediaAssets).where(eq(mediaAssets.tenantId, TENANT)).orderBy(desc(mediaAssets.createdAt));
  }
  return db.select().from(mediaAssets)
    .where(and(eq(mediaAssets.tenantId, TENANT), or(eq(mediaAssets.projectId, projectId), isNull(mediaAssets.projectId))))
    .orderBy(desc(mediaAssets.createdAt));
}

export async function listInfraResources(projectId?: string) {
  const db = getDb();
  if (!db) return null;
  if (!projectId) {
    return db.select().from(infraResources).where(eq(infraResources.tenantId, TENANT)).orderBy(asc(infraResources.kind), asc(infraResources.label));
  }
  return db.select().from(infraResources)
    .where(and(eq(infraResources.tenantId, TENANT), or(eq(infraResources.projectId, projectId), isNull(infraResources.projectId))))
    .orderBy(asc(infraResources.kind), asc(infraResources.label));
}

export async function listBudgetEntries(projectId?: string) {
  const db = getDb();
  if (!db) return null;
  if (!projectId) {
    return db.select().from(budgetEntries).where(eq(budgetEntries.tenantId, TENANT)).orderBy(desc(budgetEntries.occurredAt));
  }
  return db.select().from(budgetEntries)
    .where(and(eq(budgetEntries.tenantId, TENANT), or(eq(budgetEntries.projectId, projectId), isNull(budgetEntries.projectId))))
    .orderBy(desc(budgetEntries.occurredAt));
}

// ── Content pieces ─────────────────────────────────────────
export async function listContentPiecesByProject(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db.select().from(contentPieces)
    .where(and(
      eq(contentPieces.tenantId, TENANT),
      eq(contentPieces.projectId, projectId),
      isNull(contentPieces.archivedAt),
    ))
    .orderBy(desc(contentPieces.updatedAt));
}

// ── Phase 9 Foundations: agent_runs / human_tasks / playbooks / members / daily_spend_caps ──

export async function listAgentRuns(filters?: {
  projectId?: string;
  agentKind?: string;
  status?: string;
  limit?: number;
}) {
  const db = getDb();
  if (!db) return null;
  const conds = [eq(agentRuns.tenantId, TENANT)];
  if (filters?.projectId) conds.push(eq(agentRuns.projectId, filters.projectId));
  if (filters?.agentKind) conds.push(eq(agentRuns.agentKind, filters.agentKind));
  if (filters?.status) conds.push(eq(agentRuns.status, filters.status));
  return db.select().from(agentRuns)
    .where(and(...conds))
    .orderBy(desc(agentRuns.createdAt))
    .limit(filters?.limit ?? 100);
}

export async function listHumanTasks(filters?: { projectId?: string; status?: string; limit?: number }) {
  const db = getDb();
  if (!db) return null;
  const conds = [eq(humanTasks.tenantId, TENANT)];
  if (filters?.projectId) conds.push(eq(humanTasks.projectId, filters.projectId));
  if (filters?.status) conds.push(eq(humanTasks.status, filters.status));
  return db.select().from(humanTasks)
    .where(and(...conds))
    .orderBy(asc(humanTasks.slaDueAt), desc(humanTasks.createdAt))
    .limit(filters?.limit ?? 200);
}

export async function listPlaybooks(projectId?: string) {
  const db = getDb();
  if (!db) return null;
  if (!projectId) {
    return db.select().from(playbooks)
      .where(and(eq(playbooks.tenantId, TENANT), isNull(playbooks.archivedAt)))
      .orderBy(asc(playbooks.slug));
  }
  return db.select().from(playbooks)
    .where(and(
      eq(playbooks.tenantId, TENANT),
      isNull(playbooks.archivedAt),
      or(eq(playbooks.projectId, projectId), isNull(playbooks.projectId)),
    ))
    .orderBy(asc(playbooks.slug));
}

export async function listMembers(filters?: { userId?: number; projectId?: string }) {
  const db = getDb();
  if (!db) return null;
  const conds = [eq(members.tenantId, TENANT)];
  if (filters?.userId) conds.push(eq(members.userId, filters.userId));
  if (filters?.projectId) conds.push(eq(members.projectId, filters.projectId));
  return db.select().from(members).where(and(...conds));
}

export async function listDailySpendCaps(filters?: { projectId?: string; day?: string }) {
  const db = getDb();
  if (!db) return null;
  const conds = [eq(dailySpendCaps.tenantId, TENANT)];
  if (filters?.projectId) conds.push(eq(dailySpendCaps.projectId, filters.projectId));
  if (filters?.day) conds.push(eq(dailySpendCaps.day, filters.day));
  return db.select().from(dailySpendCaps).where(and(...conds)).orderBy(desc(dailySpendCaps.day));
}

// ── Roadmap ─────────────────────────────────────────────────
export async function listAllRoadmap() {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(roadmapItems)
    .where(and(eq(roadmapItems.tenantId, TENANT), isNull(roadmapItems.archivedAt)))
    .orderBy(asc(roadmapItems.phase), asc(roadmapItems.sortOrder), asc(roadmapItems.slug));
}

// Tenant filter is implicit (DEFAULT_TENANT_ID). Allow override for SaaS phase F.
export function withTenant(t: string) {
  return {
    listProjects: async () => {
      const db = getDb();
      if (!db) return null;
      return db.select().from(projects).where(or(eq(projects.tenantId, t), eq(projects.tenantId, TENANT)));
    },
  };
}
