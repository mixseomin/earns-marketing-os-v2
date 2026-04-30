'use server';

// Server Actions for platform account CRUD + warmup checklist updates.

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, platformAccounts, platforms } from '@mos2/db';
import {
  fetchDirectusAccountsByPlatform, fetchDirectusAccount,
  normalizeStatus, directusEnabled,
  type DirectusAccount,
} from '../bridge/directus';
import { encryptValue, decryptValue, cryptoEnabled } from '../crypto';

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

// ── Bridge: Directus as.on.tc (READ-ONLY import) ─────────────

export interface DirectusAccountSummary {
  directusId: string;
  platform: string;
  handle: string | null;
  email: string | null;
  status: string;             // normalized to mos2 state machine
  authMethod: string | null;
  has2fa: boolean;
  tags: string[];
  notes: string | null;
  duplicateCount: number;     // 1 if unique; >1 if Directus has dupes (case variants)
  duplicatePlatformKeys: string[]; // raw platform values found across dupes
}

function summarize(d: DirectusAccount): DirectusAccountSummary {
  return {
    directusId: d.id,
    platform: d.platform || '',
    handle: d.handle,
    email: d.email,
    status: normalizeStatus(d.status),
    authMethod: d.auth_method,
    has2fa: !!d.has_2fa,
    tags: Array.isArray(d.tags) ? d.tags : [],
    notes: d.notes,
    duplicateCount: 1,
    duplicatePlatformKeys: [d.platform || ''],
  };
}

export async function listDirectusAccountsForPlatform(platformKey: string): Promise<{
  ok: boolean; enabled: boolean; accounts: DirectusAccountSummary[]; error?: string;
}> {
  if (!directusEnabled()) return { ok: true, enabled: false, accounts: [] };
  try {
    const data = await fetchDirectusAccountsByPlatform(platformKey);
    // Defensive dedupe: Directus sometimes has same logical account stored
    // under different platform-key casings (e.g. 'buymeacoffee' + 'BuyMeACoffee').
    // Collapse to one row per (lowercased platform, handle) — keep the first seen
    // (sorted by handle from API) but track how many duplicates exist + their
    // platform-key variants so the UI can flag the data-quality issue.
    const dedup = new Map<string, DirectusAccountSummary>();
    for (const a of data) {
      const key = `${(a.platform || '').toLowerCase()}|${a.handle ?? ''}`;
      const existing = dedup.get(key);
      if (existing) {
        existing.duplicateCount += 1;
        if (a.platform && !existing.duplicatePlatformKeys.includes(a.platform)) {
          existing.duplicatePlatformKeys.push(a.platform);
        }
        continue;
      }
      dedup.set(key, summarize(a));
    }
    return { ok: true, enabled: true, accounts: Array.from(dedup.values()) };
  } catch (e) {
    return { ok: false, enabled: true, accounts: [], error: (e as Error).message };
  }
}

export async function importDirectusAccount(projectId: string, directusId: string): Promise<{ ok: boolean; id?: number; alreadyExists?: boolean; error?: string }> {
  if (!directusEnabled()) return { ok: false, error: 'Directus bridge disabled' };
  const db = ensureDb();

  const d = await fetchDirectusAccount(directusId);
  if (!d) return { ok: false, error: 'Directus account not found' };
  if (!d.platform) return { ok: false, error: 'Directus account has no platform set' };

  const platformKey = d.platform.toLowerCase();
  const pf = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, platformKey)).limit(1);
  if (pf.length === 0) {
    return { ok: false, error: `Platform "${d.platform}" not in MOS2 catalog. Add to catalog first.` };
  }

  // Idempotent: check if same (project, platform, handle) already exists.
  if (d.handle) {
    const existing = await db
      .select({ id: platformAccounts.id })
      .from(platformAccounts)
      .where(and(
        eq(platformAccounts.tenantId, TENANT),
        eq(platformAccounts.projectId, projectId),
        eq(platformAccounts.platformKey, platformKey),
        eq(platformAccounts.handle, d.handle),
      ))
      .limit(1);
    if (existing.length > 0) {
      return { ok: true, id: existing[0]!.id, alreadyExists: true };
    }
  }

  const importedTag = `imported:directus:${d.id}`;
  const tags = Array.isArray(d.tags) ? [...d.tags, importedTag] : [importedTag];

  const [row] = await db
    .insert(platformAccounts)
    .values({
      tenantId: TENANT,
      projectId,
      platformKey,
      handle: d.handle,
      email: d.email,
      status: normalizeStatus(d.status),
      authMethod: d.auth_method,
      has2fa: !!d.has_2fa,
      recoveryInfo: d.recovery_info ?? null,
      monthlyCost: d.monthly_cost ?? 0,
      collectStats: !!d.collect_stats,
      blockReason: null,
      notes: d.notes,
      tags,
      warmupChecklist: (d.warmup_checklist as Record<string, unknown>) || {},
    })
    .returning({ id: platformAccounts.id });

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true, id: row?.id };
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

// ── API token encryption (Phase 8 — pgcrypto) ────────────────────
// Write-only flow: setAccountApiToken stores encrypted; UI never reads back.
// Reveal: revealAccountApiToken returns plaintext one-time (server action call).
// Clear: clearAccountApiToken sets column NULL.

export async function setAccountApiToken(
  projectId: string, id: number, plaintext: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!cryptoEnabled()) return { ok: false, error: 'MOS2_SECRET_KEY chưa cấu hình trên server' };
  if (!plaintext.trim()) return { ok: false, error: 'token rỗng' };
  const db = ensureDb();
  try {
    const enc = await encryptValue(plaintext);
    await db.update(platformAccounts)
      .set({ apiTokenEnc: enc, updatedAt: new Date() })
      .where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId), eq(platformAccounts.id, id)));
    revalidatePath(`/p/${projectId}/resources`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function revealAccountApiToken(
  projectId: string, id: number,
): Promise<{ ok: boolean; plaintext?: string; error?: string }> {
  if (!cryptoEnabled()) return { ok: false, error: 'MOS2_SECRET_KEY chưa cấu hình' };
  const db = ensureDb();
  const rows = await db.select({ enc: platformAccounts.apiTokenEnc })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId), eq(platformAccounts.id, id)))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'account not found' };
  if (!rows[0]!.enc) return { ok: true, plaintext: '' };
  try {
    const plain = await decryptValue(rows[0]!.enc);
    return { ok: true, plaintext: plain };
  } catch (e) {
    return { ok: false, error: `decrypt failed: ${(e as Error).message}` };
  }
}

export async function clearAccountApiToken(
  projectId: string, id: number,
): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.update(platformAccounts)
    .set({ apiTokenEnc: null, updatedAt: new Date() })
    .where(and(eq(platformAccounts.tenantId, TENANT), eq(platformAccounts.projectId, projectId), eq(platformAccounts.id, id)));
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}
