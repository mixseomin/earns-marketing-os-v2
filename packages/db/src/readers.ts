// Read-side query helpers. Returned shape mirrors apps/web/src/lib/mock/types.ts
// so the web app can swap mock <-> DB transparently via lib/data.ts.

import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { getDb } from './client';
import { alerts, cards, feedEvents, modes, projects, squads, platforms, platformAccounts, useCases, roadmapItems } from './schema';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

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
export async function listAccountsByProject(projectId: string) {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(platformAccounts)
    .where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId)))
    .orderBy(asc(platformAccounts.sortOrder), asc(platformAccounts.id));
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
