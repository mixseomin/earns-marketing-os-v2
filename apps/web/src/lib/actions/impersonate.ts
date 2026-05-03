'use server';

import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@mos2/db';
import { getEffectiveVisibility } from './visibility';
import type { VisibilityConfig } from '@/lib/visibility';
import { ROLE_DEFAULTS } from '@/lib/visibility';

const COOKIE = 'mos2-view-as';
const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export async function enterImpersonate(userId: number, returnPath: string = '/'): Promise<void> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return;
  const jar = await cookies();
  jar.set(COOKIE, String(userId), { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 });
  redirect(returnPath);
}

export async function exitImpersonate(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect('/team');
}

export async function getImpersonateUserId(): Promise<number | null> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return null;
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  return v ? Number(v) : null;
}

export async function enterImpersonateAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get('userId'));
  const returnPath = String(formData.get('returnPath') || '/');
  await enterImpersonate(userId, returnPath);
}

export async function getImpersonateContext(): Promise<{
  active: boolean;
  targetUserId: number;
  targetName: string;
  targetRole: string;
  config: VisibilityConfig;
  configVersion: number;
} | null> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return null;
  const jar = await cookies();
  const rawId = jar.get(COOKIE)?.value;
  if (!rawId) return null;
  const targetUserId = Number(rawId);

  const db = getDb();
  if (!db) return null;

  const rows = await db.execute(sql`
    SELECT u.id, u.name, m.display_name, m.role
    FROM members m JOIN users u ON u.id = m.user_id
    WHERE m.user_id = ${targetUserId} AND m.project_id IS NULL AND m.tenant_id = ${TENANT}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return null;

  const { config, configVersion, role } = await getEffectiveVisibility(targetUserId);

  return {
    active: true,
    targetUserId,
    targetName: String(r.display_name || r.name),
    targetRole: role,
    config,
    configVersion,
  };
}
