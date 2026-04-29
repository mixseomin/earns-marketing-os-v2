'use server';

// Server Actions for use case state management.
// State columns ONLY — never touches spec (managed by seed file).

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, useCases } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export type UseCaseStatus = 'pending' | 'wip' | 'pass' | 'fail' | 'blocked' | 'skip' | 'needs-fix';

export async function markUseCase(slug: string, status: UseCaseStatus, statusNote?: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const rows = await db
    .select({ slug: useCases.slug })
    .from(useCases)
    .where(and(eq(useCases.tenantId, TENANT), eq(useCases.slug, slug)))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'use case not found' };

  // When user marks pass / pending, clear fix-tracking fields (fix has been
  // verified successful, or the case is being reset). When user marks fail
  // or needs-fix manually (without going through addFeedback), also clear —
  // it's a new iteration.
  const clearFix = ['pass', 'pending', 'fail', 'needs-fix'].includes(status);

  await db
    .update(useCases)
    .set({
      status,
      statusNote: statusNote ?? null,
      lastTestedAt: status === 'pending' ? null : new Date(),
      ...(clearFix ? { fixedIn: null, fixedAt: null, fixNote: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(useCases.slug, slug));

  revalidatePath('/tests');
  return { ok: true };
}

// addFeedback: write feedback text. By default also marks status='needs-fix'
// so the case appears in the AI's "fix queue" (feedback-driven re-iteration).
// Pass markNeedsFix=false to keep current status (e.g. just adding context to a passing case).
export async function addFeedback(
  slug: string,
  feedback: string,
  markNeedsFix: boolean = true,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const trimmed = feedback.trim();
  const set: Partial<typeof useCases.$inferInsert> = {
    feedback: trimmed || null,
    updatedAt: new Date(),
  };
  // Only flip to needs-fix when there IS feedback content. Empty feedback
  // is treated as "clear feedback", don't change status.
  if (markNeedsFix && trimmed) {
    set.status = 'needs-fix';
    set.lastTestedAt = new Date();
    // New feedback supersedes any prior fix — clear the re-test signal so
    // the next markCaseFixed (after AI ships a new fix) is recognized as fresh.
    set.fixedIn = null;
    set.fixedAt = null;
    set.fixNote = null;
  }
  await db.update(useCases).set(set).where(eq(useCases.slug, slug));
  revalidatePath('/tests');
  return { ok: true };
}

// AI calls this after shipping a fix that addresses a case's feedback.
// Sets fixedIn (commit SHA) + fixedAt + fixNote. Status stays untouched
// so the case remains in the user's needs-fix queue with a "🔄 re-test" badge.
// User then re-tests and marks pass — at which point the fields clear (see markUseCase).
export async function markCaseFixed(slug: string, commitSha: string, fixNote?: string | null): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const rows = await db
    .select({ slug: useCases.slug, status: useCases.status })
    .from(useCases)
    .where(and(eq(useCases.tenantId, TENANT), eq(useCases.slug, slug)))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: `use case "${slug}" not found` };

  await db
    .update(useCases)
    .set({
      fixedIn: commitSha,
      fixedAt: new Date(),
      fixNote: fixNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(useCases.slug, slug));

  revalidatePath('/tests');
  return { ok: true };
}

export async function clearStatus(slug: string): Promise<{ ok: boolean; error?: string }> {
  return markUseCase(slug, 'pending');
}

export async function setBlocker(slug: string, blockerRef: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db
    .update(useCases)
    .set({ blockerRef: blockerRef || null, updatedAt: new Date() })
    .where(eq(useCases.slug, slug));
  revalidatePath('/tests');
  return { ok: true };
}
