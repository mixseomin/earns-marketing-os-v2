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
