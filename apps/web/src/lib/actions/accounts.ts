'use server';

// Server Actions for platform account CRUD + warmup checklist updates.

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, platformAccounts, platforms } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export type AccountStatus =
  | 'todo' | 'creating' | 'warming' | 'active' | 'limited' | 'blocked' | 'banned';

export type AuthMethod =
  | 'password' | 'sso-google' | 'sso-github' | 'sso-x' | 'sso-linkedin'
  | 'sso-facebook' | 'sso-apple' | 'magic-link' | 'passkey' | 'phone-otp';

export interface AccountInput {
  platformKey: string;
  handle?: string | null;
  email?: string | null;
  status?: AccountStatus;
  authMethod?: AuthMethod | null;
  has2fa?: boolean;
  recoveryInfo?: string | null;
  monthlyCost?: number;
  collectStats?: boolean;
  blockReason?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface ChecklistEntry {
  done: boolean;
  value?: number | string | null;
  target?: number | null;
  updatedAt?: string;
}

async function findById(projectId: string, id: number) {
  const db = ensureDb();
  const rows = await db
    .select()
    .from(platformAccounts)
    .where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId), eq(platformAccounts.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAccount(projectId: string, input: AccountInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  const db = ensureDb();
  if (!input.platformKey) return { ok: false, error: 'platformKey required' };

  // Verify platform exists in catalog.
  const pf = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, input.platformKey)).limit(1);
  if (pf.length === 0) return { ok: false, error: `Platform "${input.platformKey}" not in catalog` };

  const [row] = await db
    .insert(platformAccounts)
    .values({
      tenantId: TENANT,
      projectId,
      platformKey: input.platformKey,
      handle: input.handle ?? null,
      email: input.email ?? null,
      status: input.status ?? 'todo',
      authMethod: input.authMethod ?? null,
      has2fa: input.has2fa ?? false,
      recoveryInfo: input.recoveryInfo ?? null,
      monthlyCost: input.monthlyCost ?? 0,
      collectStats: input.collectStats ?? false,
      blockReason: input.blockReason ?? null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      warmupChecklist: {},
    })
    .returning({ id: platformAccounts.id });

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true, id: row?.id };
}

export async function updateAccount(projectId: string, id: number, patch: Partial<AccountInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const acc = await findById(projectId, id);
  if (!acc) return { ok: false, error: 'account not found' };

  const set: Partial<typeof platformAccounts.$inferInsert> = { updatedAt: new Date() };
  if (patch.handle !== undefined) set.handle = patch.handle;
  if (patch.email !== undefined) set.email = patch.email;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.authMethod !== undefined) set.authMethod = patch.authMethod;
  if (patch.has2fa !== undefined) set.has2fa = patch.has2fa;
  if (patch.recoveryInfo !== undefined) set.recoveryInfo = patch.recoveryInfo;
  if (patch.monthlyCost !== undefined) set.monthlyCost = patch.monthlyCost | 0;
  if (patch.collectStats !== undefined) set.collectStats = patch.collectStats;
  if (patch.blockReason !== undefined) set.blockReason = patch.blockReason;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.tags !== undefined) set.tags = patch.tags;
  if (patch.platformKey !== undefined) set.platformKey = patch.platformKey;

  await db.update(platformAccounts).set(set).where(eq(platformAccounts.id, acc.id));

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}

export async function setAccountStatus(projectId: string, id: number, status: AccountStatus, blockReason?: string | null): Promise<{ ok: boolean; error?: string }> {
  return updateAccount(projectId, id, { status, blockReason: blockReason ?? null });
}

export async function deleteAccount(projectId: string, id: number): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const acc = await findById(projectId, id);
  if (!acc) return { ok: false, error: 'account not found' };

  await db.delete(platformAccounts).where(eq(platformAccounts.id, acc.id));
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}

export async function toggleChecklistItem(projectId: string, id: number, itemKey: string, done: boolean, value?: number | string | null): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const acc = await findById(projectId, id);
  if (!acc) return { ok: false, error: 'account not found' };

  const checklist = (acc.warmupChecklist as Record<string, ChecklistEntry>) || {};
  checklist[itemKey] = {
    done,
    value: value ?? null,
    target: checklist[itemKey]?.target ?? null,
    updatedAt: new Date().toISOString(),
  };

  await db
    .update(platformAccounts)
    .set({ warmupChecklist: checklist, updatedAt: new Date() })
    .where(eq(platformAccounts.id, acc.id));

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}
