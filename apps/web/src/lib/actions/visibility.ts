'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import type { VisibilityConfig } from '@/lib/visibility';
import { mergeVisibility, ROLE_DEFAULTS } from '@/lib/visibility';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export async function getEffectiveVisibility(userId: number): Promise<{ config: VisibilityConfig; configVersion: number; role: string }> {
  const db = getDb();
  const fallback: VisibilityConfig = ROLE_DEFAULTS['operator'] ?? {};
  if (!db) return { config: fallback, configVersion: 0, role: 'operator' };
  const rows = await db.execute(sql`
    SELECT m.role, m.visibility_config, m.config_version
    FROM members m WHERE m.user_id = ${userId} AND m.project_id IS NULL AND m.tenant_id = ${TENANT}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { config: fallback, configVersion: 0, role: 'operator' };
  const role = String(r.role ?? 'operator');
  const userConfig = r.visibility_config as VisibilityConfig | null;
  return {
    config: mergeVisibility(role, userConfig),
    configVersion: Number(r.config_version) || 0,
    role,
  };
}

export async function saveVisibilityConfig(
  targetUserId: number,
  config: VisibilityConfig,
  scope: 'user' | 'role',
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'FORBIDDEN' };
  const db = getDb();
  if (!db) return { ok: false, error: 'No DB' };

  try {
    if (scope === 'user') {
      await db.execute(sql`
        UPDATE members SET visibility_config = ${JSON.stringify(config)}::jsonb,
          config_version = config_version + 1, updated_at = NOW()
        WHERE user_id = ${targetUserId} AND project_id IS NULL AND tenant_id = ${TENANT}
      `);
    } else {
      // Get the role of target user first
      const rows = await db.execute(sql`
        SELECT role FROM members WHERE user_id = ${targetUserId} AND project_id IS NULL AND tenant_id = ${TENANT} LIMIT 1
      `);
      const role = String((rows as unknown as Array<{ role: string }>)[0]?.role ?? 'operator');
      // Save role-level config
      await db.execute(sql`
        INSERT INTO role_visibility_configs (tenant_id, role, config, updated_at)
        VALUES (${TENANT}, ${role}, ${JSON.stringify(config)}::jsonb, NOW())
        ON CONFLICT (tenant_id, role) DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
      `);
      // Bump config_version for ALL members with this role (so they all get real-time update)
      await db.execute(sql`
        UPDATE members SET config_version = config_version + 1, updated_at = NOW()
        WHERE role = ${role} AND project_id IS NULL AND tenant_id = ${TENANT}
      `);
    }
    revalidatePath('/team');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getMyConfigVersion(): Promise<number> {
  const me = await getCurrentUser();
  if (!me) return 0;
  const db = getDb();
  if (!db) return 0;
  const rows = await db.execute(sql`
    SELECT config_version FROM members WHERE user_id = ${me.id} AND project_id IS NULL AND tenant_id = ${TENANT} LIMIT 1
  `);
  return Number((rows as unknown as Array<{ config_version: number }>)[0]?.config_version) || 0;
}
