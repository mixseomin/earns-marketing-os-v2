'use server';

// Server Actions for Project CRUD.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getDb, projects, modes, squads, cards, alerts, feedEvents } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured — server actions require DB.');
  return db;
}

export interface ProjectInput {
  id?: string;
  name: string;
  emoji: string;
  modeId: string;
  agentsCore: number;
  agentsShared: number;
  budget: number;
  health: number;
  revenue: string;
  kpi: string;
  color: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

async function isModeValid(modeId: string): Promise<boolean> {
  const db = ensureDb();
  const rows = await db.select({ id: modes.id }).from(modes).where(eq(modes.id, modeId)).limit(1);
  return rows.length > 0;
}

export async function createProject(input: ProjectInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = ensureDb();

  if (!input.name.trim()) return { ok: false, error: 'Tên project không được rỗng' };
  if (!(await isModeValid(input.modeId))) return { ok: false, error: `Mode "${input.modeId}" không tồn tại` };

  // Auto-generate id from name; ensure uniqueness by appending -1, -2, ...
  const baseId = input.id?.trim() || slugify(input.name) || 'project';
  let id = baseId;
  for (let i = 1; i < 100; i++) {
    const existing = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).limit(1);
    if (existing.length === 0) break;
    id = `${baseId}-${i}`;
  }

  await db.insert(projects).values({
    id,
    tenantId: TENANT,
    name: input.name.trim(),
    emoji: input.emoji || '📦',
    modeId: input.modeId,
    agentsCore: input.agentsCore | 0,
    agentsShared: input.agentsShared | 0,
    budget: input.budget | 0,
    health: Math.max(0, Math.min(100, input.health | 0)),
    revenue: input.revenue || '—',
    kpi: input.kpi || '',
    alerts: 0,
    color: input.color || '#00e5ff',
  });

  revalidatePath('/');
  revalidatePath(`/p/${id}`);
  return { ok: true, id };
}

export async function updateProject(id: string, input: Partial<ProjectInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();

  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, TENANT), eq(projects.id, id)))
    .limit(1);
  if (existing.length === 0) return { ok: false, error: 'Project không tồn tại' };

  if (input.modeId && !(await isModeValid(input.modeId))) {
    return { ok: false, error: `Mode "${input.modeId}" không tồn tại` };
  }

  const patch: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.emoji !== undefined) patch.emoji = input.emoji;
  if (input.modeId !== undefined) patch.modeId = input.modeId;
  if (input.agentsCore !== undefined) patch.agentsCore = input.agentsCore | 0;
  if (input.agentsShared !== undefined) patch.agentsShared = input.agentsShared | 0;
  if (input.budget !== undefined) patch.budget = input.budget | 0;
  if (input.health !== undefined) patch.health = Math.max(0, Math.min(100, input.health | 0));
  if (input.revenue !== undefined) patch.revenue = input.revenue || '—';
  if (input.kpi !== undefined) patch.kpi = input.kpi;
  if (input.color !== undefined) patch.color = input.color;

  await db.update(projects).set(patch).where(eq(projects.id, id));

  revalidatePath('/');
  revalidatePath(`/p/${id}`);
  revalidatePath(`/p/${id}/board`);
  revalidatePath(`/p/${id}/squads`);
  revalidatePath(`/p/${id}/settings`);
  return { ok: true };
}

export async function archiveProject(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.update(projects).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, id));
  revalidatePath('/');
  return { ok: true };
}

export async function deleteProjectHard(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  // FK cascade wipes squads/cards/alerts/feed.
  await db.delete(squads).where(eq(squads.projectId, id));
  await db.delete(cards).where(eq(cards.projectId, id));
  await db.delete(alerts).where(eq(alerts.projectId, id));
  await db.delete(feedEvents).where(eq(feedEvents.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath('/');
  return { ok: true };
}

// Convenience for forms: redirect after create.
export async function createProjectAndRedirect(input: ProjectInput): Promise<void> {
  const res = await createProject(input);
  if (!res.ok || !res.id) {
    throw new Error(res.error || 'create failed');
  }
  redirect(`/p/${res.id}/settings`);
}
