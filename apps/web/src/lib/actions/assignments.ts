'use server';

// Per-member assignments: project membership + entity ownership
// (platform_accounts, proxies, browser_profiles, tribes).

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

async function adminGuard(): Promise<{ ok: boolean; error?: string }> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: 'UNAUTHENTICATED' };
  if (u.role !== 'admin') return { ok: false, error: 'FORBIDDEN — admin only' };
  return { ok: true };
}

// ── Project membership ────────────────────────────────────────────
export interface MemberProjectRow {
  projectId: string;
  projectName: string;
  isMember: boolean;
  role: string | null;
}

export async function listMemberProjects(userId: number): Promise<MemberProjectRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT p.id AS project_id, p.name AS project_name,
           m.id IS NOT NULL AS is_member,
           m.role
    FROM projects p
    LEFT JOIN members m ON m.project_id = p.id AND m.user_id = ${userId} AND m.tenant_id = ${TENANT}
    ORDER BY p.name
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    projectId: String(r.project_id),
    projectName: String(r.project_name),
    isMember: Boolean(r.is_member),
    role: (r.role as string | null) ?? null,
  }));
}

export async function setProjectMembership(userId: number, projectId: string, isMember: boolean, role: 'admin' | 'operator' | 'viewer' = 'operator'): Promise<{ ok: boolean; error?: string }> {
  const g = await adminGuard(); if (!g.ok) return g;
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  // Get user's tenant-wide member info for display_name + specialty
  const baseRows = await db.execute(sql`
    SELECT display_name, specialty FROM members WHERE user_id = ${userId} AND project_id IS NULL LIMIT 1
  `);
  const base = (baseRows as unknown as Array<{ display_name: string | null; specialty: string | null }>)[0];
  if (isMember) {
    await db.execute(sql`
      INSERT INTO members (tenant_id, user_id, project_id, role, display_name, specialty, active)
      VALUES (${TENANT}, ${userId}, ${projectId}, ${role}, ${base?.display_name ?? null}, ${base?.specialty ?? null}, true)
      ON CONFLICT (user_id, project_id) DO UPDATE SET role = ${role}, active = true, updated_at = NOW()
    `);
  } else {
    await db.execute(sql`
      DELETE FROM members WHERE user_id = ${userId} AND project_id = ${projectId} AND tenant_id = ${TENANT}
    `);
  }
  revalidatePath('/team');
  revalidatePath('/');
  return { ok: true };
}

// ── Entity ownership (accounts / proxies / profiles / tribes) ─────
export type OwnableEntity = 'platform_account' | 'proxy' | 'browser_profile' | 'tribe';

export interface MemberEntitySummary {
  type: OwnableEntity;
  id: number;
  label: string;
  meta: string;        // e.g. "@oritapp · medium" or "SG-mobile-3 · residential"
  ownerUserId: number | null;
  ownerName: string | null;
}

export async function listAssignableEntities(userId: number): Promise<{
  accounts: MemberEntitySummary[];
  proxies: MemberEntitySummary[];
  profiles: MemberEntitySummary[];
  tribes: MemberEntitySummary[];
}> {
  const db = getDb();
  if (!db) return { accounts: [], proxies: [], profiles: [], tribes: [] };

  const [accRows, proxyRows, profRows, tribeRows] = await Promise.all([
    db.execute(sql`
      SELECT pa.id, pa.handle, pa.platform_key, pa.project_id, pa.owner_user_id,
             pl.label AS plabel, u.name AS owner_name
      FROM platform_accounts pa
      LEFT JOIN platforms pl ON pl.key = pa.platform_key
      LEFT JOIN users u ON u.id = pa.owner_user_id
      WHERE pa.tenant_id = ${TENANT}
      ORDER BY pa.platform_key, pa.handle
    `),
    db.execute(sql`
      SELECT p.id, p.label, p.type, p.location, p.owner_user_id, u.name AS owner_name
      FROM proxies p LEFT JOIN users u ON u.id = p.owner_user_id
      WHERE p.tenant_id = ${TENANT} AND p.archived_at IS NULL
      ORDER BY p.label
    `),
    db.execute(sql`
      SELECT b.id, b.label, b.tool, b.owner_user_id, u.name AS owner_name
      FROM browser_profiles b LEFT JOIN users u ON u.id = b.owner_user_id
      WHERE b.tenant_id = ${TENANT} AND b.archived_at IS NULL
      ORDER BY b.label
    `),
    db.execute(sql`
      SELECT t.id, t.name AS label, t.project_id, t.owner_user_id, u.name AS owner_name
      FROM tribes t LEFT JOIN users u ON u.id = t.owner_user_id
      WHERE t.tenant_id = ${TENANT}
      ORDER BY t.project_id, t.name
    `),
  ]);

  const mapAcc = (r: Record<string, unknown>): MemberEntitySummary => ({
    type: 'platform_account', id: Number(r.id),
    label: `@${r.handle ?? '(no-handle)'}`,
    meta: `${r.plabel ?? r.platform_key} · ${r.project_id}`,
    ownerUserId: r.owner_user_id ? Number(r.owner_user_id) : null,
    ownerName: (r.owner_name as string | null) ?? null,
  });
  const mapProxy = (r: Record<string, unknown>): MemberEntitySummary => ({
    type: 'proxy', id: Number(r.id),
    label: String(r.label),
    meta: `${r.type}${r.location ? ` · ${r.location}` : ''}`,
    ownerUserId: r.owner_user_id ? Number(r.owner_user_id) : null,
    ownerName: (r.owner_name as string | null) ?? null,
  });
  const mapProf = (r: Record<string, unknown>): MemberEntitySummary => ({
    type: 'browser_profile', id: Number(r.id),
    label: String(r.label), meta: String(r.tool ?? ''),
    ownerUserId: r.owner_user_id ? Number(r.owner_user_id) : null,
    ownerName: (r.owner_name as string | null) ?? null,
  });
  const mapTribe = (r: Record<string, unknown>): MemberEntitySummary => ({
    type: 'tribe', id: Number(r.id),
    label: String(r.label),
    meta: String(r.project_id ?? ''),
    ownerUserId: r.owner_user_id ? Number(r.owner_user_id) : null,
    ownerName: (r.owner_name as string | null) ?? null,
  });

  return {
    accounts: (accRows as unknown as Array<Record<string, unknown>>).map(mapAcc),
    proxies: (proxyRows as unknown as Array<Record<string, unknown>>).map(mapProxy),
    profiles: (profRows as unknown as Array<Record<string, unknown>>).map(mapProf),
    tribes: (tribeRows as unknown as Array<Record<string, unknown>>).map(mapTribe),
  };
  // userId param reserved for future filter (currently returns full pool with owner highlighted)
}

const TABLE_BY_TYPE: Record<OwnableEntity, string> = {
  platform_account: 'platform_accounts',
  proxy: 'proxies',
  browser_profile: 'browser_profiles',
  tribe: 'tribes',
};

// ── Member assignment summary (for /team inventory + visibility audit) ──
export interface MemberAssignmentSummary {
  projects: Array<{ projectId: string; projectName: string; role: string }>;
  accounts: Array<{ id: number; handle: string; platformKey: string; platformLabel: string; projectId: string }>;
  proxies: Array<{ id: number; label: string; type: string }>;
  profiles: Array<{ id: number; label: string; tool: string }>;
  tribes: Array<{ id: number; label: string; projectId: string }>;
  pendingTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  done7d: number;
  failedTasks: number;
  totalTasks: number;
  lastDone: string | null;
}

export async function getMemberAssignments(userId: number): Promise<MemberAssignmentSummary> {
  const db = getDb();
  const empty: MemberAssignmentSummary = { projects: [], accounts: [], proxies: [], profiles: [], tribes: [], pendingTasks: 0, inProgressTasks: 0, doneTasks: 0, done7d: 0, failedTasks: 0, totalTasks: 0, lastDone: null };
  if (!db) return empty;
  const [projRows, accRows, pxRows, bpRows, trRows, taskRows] = await Promise.all([
    db.execute(sql`
      SELECT m.project_id, p.name AS project_name, m.role
      FROM members m JOIN projects p ON p.id = m.project_id
      WHERE m.user_id = ${userId} AND m.project_id IS NOT NULL AND m.active = true
      ORDER BY p.name
    `),
    db.execute(sql`
      SELECT pa.id, pa.handle, pa.platform_key, COALESCE(pl.label, pa.platform_key) AS platform_label, pa.project_id
      FROM platform_accounts pa LEFT JOIN platforms pl ON pl.key = pa.platform_key
      WHERE pa.owner_user_id = ${userId}
      ORDER BY pa.project_id, pa.platform_key
    `),
    db.execute(sql`
      SELECT id, label, type FROM proxies
      WHERE owner_user_id = ${userId} AND archived_at IS NULL
      ORDER BY label
    `),
    db.execute(sql`
      SELECT id, label, tool FROM browser_profiles
      WHERE owner_user_id = ${userId} AND archived_at IS NULL
      ORDER BY label
    `),
    db.execute(sql`
      SELECT id, name AS label, project_id FROM tribes
      WHERE owner_user_id = ${userId}
      ORDER BY project_id, name
    `),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
        COUNT(*) FILTER (WHERE status IN ('claimed', 'in_progress'))::int AS in_progress_count,
        COUNT(*) FILTER (WHERE status IN ('completed', 'verified'))::int AS done_count,
        COUNT(*) FILTER (WHERE status IN ('completed', 'verified') AND completed_at > now() - interval '7 days')::int AS done_7d,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
        COUNT(*)::int AS total_count,
        MAX(completed_at) AS last_done
      FROM human_tasks WHERE assigned_user_id = ${userId}
    `),
  ]);
  const taskR = (taskRows as unknown as Array<{ pending_count: number; in_progress_count: number; done_count: number; done_7d: number; failed_count: number; total_count: number; last_done: string | null }>)[0];
  return {
    projects: (projRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      projectId: String(r.project_id), projectName: String(r.project_name), role: String(r.role ?? 'operator'),
    })),
    accounts: (accRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id), handle: String(r.handle ?? '(no-handle)'),
      platformKey: String(r.platform_key ?? ''), platformLabel: String(r.platform_label), projectId: String(r.project_id),
    })),
    proxies: (pxRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id), label: String(r.label), type: String(r.type),
    })),
    profiles: (bpRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id), label: String(r.label), tool: String(r.tool),
    })),
    tribes: (trRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id), label: String(r.label), projectId: String(r.project_id ?? ''),
    })),
    pendingTasks: taskR?.pending_count ?? 0,
    inProgressTasks: taskR?.in_progress_count ?? 0,
    doneTasks: taskR?.done_count ?? 0,
    done7d: taskR?.done_7d ?? 0,
    failedTasks: taskR?.failed_count ?? 0,
    totalTasks: taskR?.total_count ?? 0,
    lastDone: taskR?.last_done ?? null,
  };
}

// ── Member activity timeline ─────────────────────────────────────
export interface MemberActivityEvent {
  type: 'task_claimed' | 'task_completed' | 'task_assigned' | 'login' | 'task_published';
  at: string;
  taskId?: number;
  taskTitle?: string;
  projectId?: string | null;
  feedbackType?: string | null;
  publishUrl?: string | null;
}

export async function listMemberActivity(userId: number, limit = 30): Promise<MemberActivityEvent[]> {
  const db = getDb();
  if (!db) return [];
  // Combine multiple event sources via UNION; dedupe + sort by time desc.
  const rows = await db.execute(sql`
    (
      SELECT 'task_claimed' AS type, claimed_at AS at, id AS task_id, title AS task_title,
             project_id, feedback_type, publish_url
      FROM human_tasks WHERE assigned_user_id = ${userId} AND claimed_at IS NOT NULL
    )
    UNION ALL
    (
      SELECT 'task_completed', completed_at, id, title, project_id, feedback_type, publish_url
      FROM human_tasks WHERE assigned_user_id = ${userId} AND completed_at IS NOT NULL
    )
    UNION ALL
    (
      SELECT 'task_published', verified_at, id, title, project_id, feedback_type, publish_url
      FROM human_tasks WHERE assigned_user_id = ${userId} AND publish_url IS NOT NULL
    )
    UNION ALL
    (
      SELECT 'task_assigned', created_at, id, title, project_id, NULL, NULL
      FROM human_tasks WHERE assigned_user_id = ${userId}
    )
    UNION ALL
    (
      SELECT 'login', last_login_at, NULL, NULL, NULL, NULL, NULL
      FROM users WHERE id = ${userId} AND last_login_at IS NOT NULL
    )
    ORDER BY at DESC NULLS LAST LIMIT ${limit}
  `);
  const toIso = (v: unknown) => v instanceof Date ? v.toISOString() : (typeof v === 'string' ? new Date(v).toISOString() : '');
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    type: String(r.type) as MemberActivityEvent['type'],
    at: toIso(r.at),
    taskId: r.task_id ? Number(r.task_id) : undefined,
    taskTitle: r.task_title ? String(r.task_title) : undefined,
    projectId: (r.project_id as string | null) ?? null,
    feedbackType: (r.feedback_type as string | null) ?? null,
    publishUrl: (r.publish_url as string | null) ?? null,
  })).filter((e) => e.at);
}

// ── Project team (for per-project /p/[id]/team page) ──────────────
export interface ProjectMemberRow {
  userId: number;
  email: string;
  name: string;
  displayName: string;
  role: string;
  specialty: string;
  active: boolean;
  // Counts within this project
  accountsCount: number;
  pendingTasks: number;
}

export async function listProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT u.id AS user_id, u.email, u.name,
           m.role, m.display_name, m.active,
           tw.specialty,                              -- tenant-wide specialty
           (SELECT COUNT(*)::int FROM platform_accounts pa
              JOIN project_accounts pj ON pj.account_id = pa.id
              WHERE pa.owner_user_id = u.id AND pj.project_id = ${projectId}) AS accounts_count,
           (SELECT COUNT(*)::int FROM human_tasks WHERE assigned_user_id = u.id AND project_id = ${projectId} AND status = 'pending') AS pending_count
    FROM members m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN members tw ON tw.user_id = u.id AND tw.project_id IS NULL
    WHERE m.tenant_id = ${TENANT} AND m.project_id = ${projectId}
    ORDER BY m.role, COALESCE(m.display_name, u.name)
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    userId: Number(r.user_id),
    email: String(r.email),
    name: String(r.name ?? ''),
    displayName: String(r.display_name ?? r.name ?? ''),
    role: String(r.role ?? 'operator'),
    specialty: String(r.specialty ?? 'other'),
    active: Boolean(r.active),
    accountsCount: Number(r.accounts_count) || 0,
    pendingTasks: Number(r.pending_count) || 0,
  }));
}

// ── Account assignment actions ─────────────────────────────────────

// Assign accounts to a member (sets owner_user_id)
export async function assignAccountsToMember(
  userId: number,
  accountIds: number[],
  projectId: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const db = getDb();
  if (!db) return { ok: false, error: 'No DB' };
  try {
    // Multi-brand: scope qua project_accounts pivot thay vì platform_accounts.project_id
    // (account có thể thuộc project khác nhưng share sang project hiện tại).
    // Clear existing assignments của user này cho mọi account đang link với project.
    await db.execute(sql`
      UPDATE platform_accounts pa SET owner_user_id = NULL
      WHERE pa.owner_user_id = ${userId}
        AND EXISTS (
          SELECT 1 FROM project_accounts pj
          WHERE pj.account_id = pa.id AND pj.project_id = ${projectId}
        )
    `);
    if (accountIds.length > 0) {
      for (const aid of accountIds) {
        await db.execute(sql`
          UPDATE platform_accounts pa SET owner_user_id = ${userId}
          WHERE pa.id = ${aid}
            AND EXISTS (
              SELECT 1 FROM project_accounts pj
              WHERE pj.account_id = pa.id AND pj.project_id = ${projectId}
            )
        `);
      }
    }
    // Bump config_version so real-time watcher fires
    await db.execute(sql`
      UPDATE members SET config_version = config_version + 1
      WHERE user_id = ${userId} AND project_id IS NULL
    `);
    revalidatePath(`/p/${projectId}/resources`);
    revalidatePath('/team');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// List all accounts in a project with their current owner
// Số account mỗi project có (qua project_accounts) → biết project nào có acc để giao.
export async function projectAccountCounts(): Promise<Record<string, number>> {
  const db = getDb();
  if (!db) return {};
  const rows = await db.execute(sql`SELECT project_id, count(*)::int AS n FROM project_accounts GROUP BY project_id`);
  const out: Record<string, number> = {};
  for (const r of rows as unknown as Array<{ project_id: string; n: number }>) out[String(r.project_id)] = Number(r.n);
  return out;
}

export async function listProjectAccountsForAssignment(projectId: string): Promise<Array<{
  id: number;
  platformKey: string;
  handle: string | null;
  status: string;
  ownerUserId: number | null;
}>> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return [];
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT pa.id, pa.platform_key, pa.handle, pa.status, pa.owner_user_id
    FROM platform_accounts pa
    JOIN project_accounts pj ON pj.account_id = pa.id
    WHERE pj.project_id = ${projectId}
    ORDER BY pa.platform_key, pa.handle
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    platformKey: String(r.platform_key ?? ''),
    handle: r.handle ? String(r.handle) : null,
    status: String(r.status ?? 'todo'),
    ownerUserId: r.owner_user_id ? Number(r.owner_user_id) : null,
  }));
}

// Get accounts for a project with assignment flag for a specific user
export async function getProjectAccountsForMember(projectId: string, userId: number): Promise<Array<{
  id: number;
  platformKey: string;
  handle: string | null;
  status: string;
  ownerUserId: number | null;
  isAssigned: boolean;
}>> {
  const accounts = await listProjectAccountsForAssignment(projectId);
  return accounts.map((a) => ({ ...a, isAssigned: a.ownerUserId === userId }));
}

// Enable resources vault for a user when assigning accounts
export async function enableResourcesForMember(userId: number): Promise<void> {
  const db = getDb();
  if (!db) return;
  // Merge resources.accounts = true + nav.resources = true into existing visibility_config
  await db.execute(sql`
    UPDATE members
    SET visibility_config = COALESCE(visibility_config, '{}'::jsonb)
      || '{"nav":{"inbox":true,"resources":true},"resources":{"accounts":true}}'::jsonb,
      config_version = config_version + 1,
      updated_at = NOW()
    WHERE user_id = ${userId} AND project_id IS NULL AND tenant_id = ${TENANT}
  `);
}

export async function setEntityOwner(type: OwnableEntity, entityId: number, ownerUserId: number | null): Promise<{ ok: boolean; error?: string }> {
  const g = await adminGuard(); if (!g.ok) return g;
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  const table = TABLE_BY_TYPE[type];
  if (!table) return { ok: false, error: `Invalid type ${type}` };
  // Use raw query (table name must be safe — we control the constant)
  await db.execute(sql.raw(`UPDATE ${table} SET owner_user_id = ${ownerUserId === null ? 'NULL' : Number(ownerUserId)}, updated_at = NOW() WHERE id = ${Number(entityId)}`));
  revalidatePath('/team');
  return { ok: true };
}

// All projects available for admin to assign resources from
export async function listAllProjectsForAssignment(): Promise<Array<{ id: string; name: string; emoji: string }>> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return [];
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`SELECT id, name, emoji FROM projects WHERE tenant_id = ${TENANT} ORDER BY name`);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    emoji: String(r.emoji ?? ''),
  }));
}
