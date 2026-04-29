// Read-side query helpers. Returned shape mirrors apps/web/src/lib/mock/types.ts
// so the web app can swap mock <-> DB transparently via lib/data.ts.

import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { getDb } from './client';
import { alerts, cards, feedEvents, modes, projects, squads } from './schema';

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
