'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull, asc, desc } from 'drizzle-orm';
import { getDb, libraryTools, skillSnippets } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

// ── Tools ─────────────────────────────────────────────────────────
export interface ToolRow {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requiresEnv: string | null;
  sortOrder: number;
  archived: boolean;
}

export async function listTools(): Promise<ToolRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.select().from(libraryTools)
    .where(and(eq(libraryTools.tenantId, TENANT), isNull(libraryTools.archivedAt)))
    .orderBy(asc(libraryTools.sortOrder), asc(libraryTools.id));
  return rows.map((r) => ({
    id: r.id, name: r.name, description: r.description, category: r.category, icon: r.icon,
    requiresEnv: r.requiresEnv, sortOrder: r.sortOrder, archived: false,
  }));
}

export interface ToolInput {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requiresEnv?: string | null;
  sortOrder?: number;
}

export async function createTool(input: ToolInput): Promise<{ ok: boolean; error?: string }> {
  if (!input.id.trim() || !input.name.trim()) return { ok: false, error: 'id và name không được rỗng' };
  if (!/^[a-z0-9-]+$/.test(input.id)) return { ok: false, error: 'id chỉ chấp nhận lowercase + dash' };
  const db = ensureDb();
  try {
    await db.insert(libraryTools).values({
      id: input.id, tenantId: TENANT, name: input.name, description: input.description,
      category: input.category, icon: input.icon, requiresEnv: input.requiresEnv ?? null,
      sortOrder: input.sortOrder ?? 100,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath('/library');
  return { ok: true };
}

export async function updateTool(id: string, patch: Partial<ToolInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Partial<typeof libraryTools.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.icon !== undefined) set.icon = patch.icon;
  if (patch.requiresEnv !== undefined) set.requiresEnv = patch.requiresEnv;
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
  await db.update(libraryTools).set(set).where(eq(libraryTools.id, id));
  revalidatePath('/library');
  return { ok: true };
}

export async function archiveTool(id: string): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.update(libraryTools).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(libraryTools.id, id));
  revalidatePath('/library');
  return { ok: true };
}

// ── Skill snippets ────────────────────────────────────────────────
export interface SkillRow {
  id: number;
  slug: string;
  title: string;
  body: string;
  tags: string[];
  updatedAt: string;
}

export async function listSkills(): Promise<SkillRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.select().from(skillSnippets)
    .where(and(eq(skillSnippets.tenantId, TENANT), isNull(skillSnippets.archivedAt)))
    .orderBy(desc(skillSnippets.updatedAt));
  return rows.map((r) => ({
    id: r.id, slug: r.slug, title: r.title, body: r.body,
    tags: (r.tags as string[]) ?? [],
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export interface SkillInput {
  slug: string;
  title: string;
  body: string;
  tags?: string[];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'skill';
}

export async function createSkill(input: SkillInput): Promise<{ ok: boolean; slug?: string; error?: string }> {
  if (!input.title.trim()) return { ok: false, error: 'title không được rỗng' };
  const db = ensureDb();
  let slug = input.slug?.trim() || slugify(input.title);
  // Ensure unique
  for (let i = 1; i < 100; i++) {
    const ex = await db.select({ id: skillSnippets.id }).from(skillSnippets)
      .where(and(eq(skillSnippets.tenantId, TENANT), eq(skillSnippets.slug, slug))).limit(1);
    if (ex.length === 0) break;
    slug = `${slugify(input.title)}-${i}`;
  }
  await db.insert(skillSnippets).values({
    tenantId: TENANT, slug, title: input.title, body: input.body, tags: input.tags ?? [],
  });
  revalidatePath('/library');
  return { ok: true, slug };
}

export async function updateSkill(id: number, patch: Partial<SkillInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Partial<typeof skillSnippets.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.body !== undefined) set.body = patch.body;
  if (patch.tags !== undefined) set.tags = patch.tags;
  if (patch.slug !== undefined) set.slug = patch.slug;
  await db.update(skillSnippets).set(set).where(eq(skillSnippets.id, id));
  revalidatePath('/library');
  return { ok: true };
}

export async function archiveSkill(id: number): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.update(skillSnippets).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(skillSnippets.id, id));
  revalidatePath('/library');
  return { ok: true };
}
