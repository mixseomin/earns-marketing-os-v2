'use server';

// Team management — users + members CRUD + current-user cookie + assignment helpers.

import { revalidatePath } from 'next/cache';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, users, members } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

async function adminGuard(): Promise<{ ok: boolean; error?: string }> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: 'UNAUTHENTICATED' };
  if (u.role !== 'admin') return { ok: false, error: 'FORBIDDEN — admin only' };
  return { ok: true };
}

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

// ── Member listing (joined with user) ──────────────────────────────
export type Specialty = 'founder' | 'writer' | 'community' | 'designer' | 'video' | 'outreach' | 'analytics' | 'ops' | 'marketing-lead' | 'other';
export type MemberRole = 'admin' | 'operator' | 'viewer';

export interface TeamMemberRow {
  memberId: number;
  userId: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  displayName: string;
  role: MemberRole;
  specialty: Specialty;
  bio: string | null;
  active: boolean;
  projectId: string | null;       // null = tenant-wide
  lastLoginAt: string | null;
  createdAt: string;
  // workload
  pendingTasksCount: number;
  inProgressTasksCount: number;
}

export async function listTeamMembers(): Promise<TeamMemberRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT m.id AS member_id, u.id AS user_id, u.email, u.name, u.avatar_url,
           m.display_name, m.role, m.specialty, m.bio, m.active, m.project_id,
           u.last_login_at, m.created_at,
           (SELECT COUNT(*)::int FROM human_tasks WHERE assigned_user_id = u.id AND status = 'pending') AS pending_count,
           (SELECT COUNT(*)::int FROM human_tasks WHERE assigned_user_id = u.id AND status IN ('claimed','in_progress')) AS in_progress_count
    FROM members m
    JOIN users u ON u.id = m.user_id
    WHERE m.tenant_id = ${TENANT} AND m.project_id IS NULL
    ORDER BY m.active DESC, m.created_at ASC
  `);
  const toIso = (v: unknown) => v instanceof Date ? v.toISOString() : (typeof v === 'string' ? new Date(v).toISOString() : null);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    memberId: Number(r.member_id),
    userId: Number(r.user_id),
    email: String(r.email),
    name: String(r.name ?? ''),
    avatarUrl: (r.avatar_url as string | null) ?? null,
    displayName: String(r.display_name ?? r.name ?? ''),
    role: String(r.role ?? 'admin') as MemberRole,
    specialty: String(r.specialty ?? 'other') as Specialty,
    bio: (r.bio as string | null) ?? null,
    active: Boolean(r.active),
    projectId: (r.project_id as string | null) ?? null,
    lastLoginAt: toIso(r.last_login_at),
    createdAt: toIso(r.created_at) ?? '',
    pendingTasksCount: Number(r.pending_count) || 0,
    inProgressTasksCount: Number(r.in_progress_count) || 0,
  }));
}

// ── Create / update member ─────────────────────────────────────────
export interface MemberInput {
  email: string;
  name: string;
  displayName?: string;
  role?: MemberRole;
  specialty?: Specialty;
  bio?: string | null;
  active?: boolean;
  avatarUrl?: string | null;
  projectId?: string | null;
}

export async function createTeamMember(input: MemberInput): Promise<{ ok: boolean; userId?: number; error?: string }> {
  const g = await adminGuard(); if (!g.ok) return g;
  if (!input.email?.trim()) return { ok: false, error: 'Email rỗng' };
  if (!input.name?.trim()) return { ok: false, error: 'Name rỗng' };
  const db = ensureDb();
  try {
    // 1. Insert user (idempotent on email)
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, TENANT), eq(users.email, input.email.trim())))
      .limit(1);
    let userId: number;
    if (existing[0]) {
      userId = existing[0].id;
      // Update name + avatar
      await db.update(users)
        .set({ name: input.name.trim(), avatarUrl: input.avatarUrl ?? null, updatedAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      const inserted = await db.insert(users).values({
        tenantId: TENANT,
        email: input.email.trim(),
        name: input.name.trim(),
        avatarUrl: input.avatarUrl ?? null,
        authKind: 'session',
      }).returning({ id: users.id });
      userId = inserted[0]!.id;
    }

    // 2. Insert/update member record (tenant-wide, project_id = null)
    const memberExists = await db.select({ id: members.id })
      .from(members)
      .where(and(
        eq(members.tenantId, TENANT),
        eq(members.userId, userId),
        sql`${members.projectId} IS NULL`
      ))
      .limit(1);
    if (memberExists[0]) {
      await db.update(members).set({
        role: input.role ?? 'operator',
        displayName: input.displayName ?? input.name.trim(),
        specialty: input.specialty ?? 'other',
        bio: input.bio ?? null,
        active: input.active ?? true,
        updatedAt: new Date(),
      }).where(eq(members.id, memberExists[0].id));
    } else {
      await db.insert(members).values({
        tenantId: TENANT,
        userId,
        projectId: null,
        role: input.role ?? 'operator',
        displayName: input.displayName ?? input.name.trim(),
        specialty: input.specialty ?? 'other',
        bio: input.bio ?? null,
        active: input.active ?? true,
      });
    }
    revalidatePath('/team');
    return { ok: true, userId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateTeamMember(userId: number, patch: Partial<MemberInput>): Promise<{ ok: boolean; error?: string }> {
  const g = await adminGuard(); if (!g.ok) return g;
  const db = ensureDb();
  try {
    if (patch.name !== undefined || patch.email !== undefined || patch.avatarUrl !== undefined) {
      const userPatch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
      if (patch.name !== undefined) userPatch.name = patch.name;
      if (patch.email !== undefined) userPatch.email = patch.email;
      if (patch.avatarUrl !== undefined) userPatch.avatarUrl = patch.avatarUrl;
      await db.update(users).set(userPatch).where(eq(users.id, userId));
    }
    const memberPatch: Partial<typeof members.$inferInsert> = { updatedAt: new Date() };
    if (patch.role !== undefined) memberPatch.role = patch.role;
    if (patch.displayName !== undefined) memberPatch.displayName = patch.displayName;
    if (patch.specialty !== undefined) memberPatch.specialty = patch.specialty;
    if (patch.bio !== undefined) memberPatch.bio = patch.bio;
    if (patch.active !== undefined) memberPatch.active = patch.active;
    if (Object.keys(memberPatch).length > 1) {
      await db.update(members)
        .set(memberPatch)
        .where(and(
          eq(members.tenantId, TENANT),
          eq(members.userId, userId),
          sql`${members.projectId} IS NULL`
        ));
    }
    revalidatePath('/team');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function archiveTeamMember(userId: number): Promise<{ ok: boolean; error?: string }> {
  const g = await adminGuard(); if (!g.ok) return g;
  const db = ensureDb();
  await db.update(members)
    .set({ active: false, updatedAt: new Date() })
    .where(and(
      eq(members.tenantId, TENANT),
      eq(members.userId, userId),
      sql`${members.projectId} IS NULL`
    ));
  revalidatePath('/team');
  return { ok: true };
}

// ── Current user — delegates to real session auth (lib/auth) ───────
// Old cookie 'mos2-current-user-id' deprecated. Now driven by session cookie.
import { getCurrentUserId as _getCurrentUserId } from '@/lib/auth';
export async function getCurrentUserId(): Promise<number | null> {
  return _getCurrentUserId();
}

// ── Assignment helpers ─────────────────────────────────────────────
export async function assignTaskToUser(taskId: number, userId: number | null): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  try {
    await db.execute(sql`UPDATE human_tasks SET assigned_user_id = ${userId}, updated_at = NOW() WHERE id = ${taskId}`);
    revalidatePath('/inbox');
    revalidatePath('/p/[id]/inbox', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
