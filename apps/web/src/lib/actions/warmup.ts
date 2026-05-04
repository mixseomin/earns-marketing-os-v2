'use server';

// Run auto-fetch for warmup checklist items having `auto:` flag.
// 1 account at a time (UI button) hoặc batch (cron route).

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, platformAccounts, platforms } from '@mos2/db';
import { runAutoFetch } from '@/lib/warmup-checks';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

interface ChecklistItem {
  key: string;
  auto?: string;
  target?: number;
}
interface ChecklistEntry {
  done: boolean;
  value?: number | string | null;
  target?: number | null;
  updatedAt?: string;
  lastAutoCheckAt?: string;
  lastAutoError?: string;
}

export interface AutoCheckReport {
  accountId: number;
  handle: string | null;
  platform: string;
  results: Array<{ key: string; auto: string; ok: boolean; value?: number | string; error?: string; before?: number | string | null }>;
}

export async function runAccountAutoCheck(
  projectId: string, accountId: number,
): Promise<{ ok: boolean; report?: AutoCheckReport; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL not configured' };

  const accs = await db.select().from(platformAccounts).where(and(
    eq(platformAccounts.tenantId, TENANT),
    eq(platformAccounts.projectId, projectId),
    eq(platformAccounts.id, accountId),
  )).limit(1);
  if (accs.length === 0) return { ok: false, error: 'account not found' };
  const acc = accs[0]!;

  const pf = await db.select({ checklist: platforms.checklist }).from(platforms).where(eq(platforms.key, acc.platformKey)).limit(1);
  if (pf.length === 0) return { ok: false, error: 'platform not in catalog' };

  const checklist = (pf[0]!.checklist as ChecklistItem[]) || [];
  const autoItems = checklist.filter((c) => c.auto);
  if (autoItems.length === 0) {
    return { ok: true, report: { accountId, handle: acc.handle, platform: acc.platformKey, results: [] } };
  }

  const current = (acc.warmupChecklist as Record<string, ChecklistEntry>) || {};
  const next = { ...current };
  const report: AutoCheckReport = { accountId, handle: acc.handle, platform: acc.platformKey, results: [] };
  const nowIso = new Date().toISOString();

  for (const item of autoItems) {
    const before = current[item.key]?.value ?? null;
    const fetched = await runAutoFetch(item.auto!, acc.handle);
    const entry: ChecklistEntry = next[item.key] ?? { done: false };
    if (fetched.ok) {
      entry.value = fetched.value ?? null;
      entry.target = item.target ?? entry.target ?? null;
      entry.lastAutoCheckAt = nowIso;
      delete entry.lastAutoError;
      // Auto-mark done if numeric value reaches target.
      if (typeof fetched.value === 'number' && typeof item.target === 'number' && fetched.value >= item.target) {
        entry.done = true;
      }
      entry.updatedAt = nowIso;
    } else {
      entry.lastAutoError = fetched.error;
      entry.lastAutoCheckAt = nowIso;
    }
    next[item.key] = entry;
    report.results.push({ key: item.key, auto: item.auto!, ok: fetched.ok, value: fetched.value, error: fetched.error, before });
  }

  await db.update(platformAccounts)
    .set({ warmupChecklist: next, updatedAt: new Date() })
    .where(eq(platformAccounts.id, accountId));

  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true, report };
}

// Batch run for cron — iterates all accounts trong warming state across all real projects.
export async function runAllPendingAutoChecks(): Promise<{
  ok: boolean; checked: number; updated: number; errors: number; details: AutoCheckReport[];
}> {
  const db = getDb();
  if (!db) return { ok: false, checked: 0, updated: 0, errors: 0, details: [] };

  // Only check active+warming accounts to avoid wasted API calls.
  const candidates = await db.select({
    id: platformAccounts.id,
    projectId: platformAccounts.projectId,
    platformKey: platformAccounts.platformKey,
    handle: platformAccounts.handle,
    status: platformAccounts.status,
  }).from(platformAccounts).where(and(
    eq(platformAccounts.tenantId, TENANT),
  ));
  const filtered = candidates.filter((a) => a.status === 'warming' || a.status === 'active');

  const details: AutoCheckReport[] = [];
  let updated = 0, errors = 0;
  for (const a of filtered) {
    if (!a.handle) continue;
    if (!a.projectId) continue;  // tenant-only account (no owner project) — skip cron auto-check for now
    const res = await runAccountAutoCheck(a.projectId, a.id);
    if (res.ok && res.report) {
      details.push(res.report);
      updated += res.report.results.filter((r) => r.ok).length;
      errors += res.report.results.filter((r) => !r.ok).length;
    } else {
      errors += 1;
    }
  }
  return { ok: true, checked: filtered.length, updated, errors, details };
}
