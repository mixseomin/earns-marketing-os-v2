'use server';

// Cấp/thu hồi per-user Crew ext token (Pha 2 staff ops). Plaintext hiện 1 lần, DB chỉ giữ sha256.

import { createHash, randomBytes } from 'crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

async function adminGuard(): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: 'UNAUTHENTICATED' };
  if (u.role !== 'admin') return { ok: false, error: 'FORBIDDEN — admin only' };
  return { ok: true };
}

// Revoke token cũ + sinh token mới. Trả plaintext 1 lần (không lưu lại được).
export async function issueExtToken(userId: number): Promise<{ ok: boolean; token?: string; error?: string }> {
  const g = await adminGuard(); if (!g.ok) return g;
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const token = `mos2_${randomBytes(24).toString('hex')}`;
  const hash = createHash('sha256').update(token).digest('hex');
  await db.execute(sql`UPDATE ext_tokens SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`);
  await db.execute(sql`INSERT INTO ext_tokens (tenant_id, user_id, token_hash) VALUES (${TENANT}, ${userId}, ${hash})`);
  revalidatePath('/architecture');
  return { ok: true, token };
}

export async function revokeExtToken(userId: number): Promise<{ ok: boolean; error?: string }> {
  const g = await adminGuard(); if (!g.ok) return g;
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`UPDATE ext_tokens SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`);
  revalidatePath('/architecture');
  return { ok: true };
}
