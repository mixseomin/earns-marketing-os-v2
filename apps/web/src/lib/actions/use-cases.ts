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

export type UseCaseStatus = 'pending' | 'wip' | 'pass' | 'fail' | 'blocked' | 'skip';

export async function markUseCase(slug: string, status: UseCaseStatus, statusNote?: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const rows = await db
    .select({ slug: useCases.slug })
    .from(useCases)
    .where(and(eq(useCases.tenantId, TENANT), eq(useCases.slug, slug)))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'use case not found' };

  await db
    .update(useCases)
    .set({
      status,
      statusNote: statusNote ?? null,
      lastTestedAt: status === 'pending' ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(useCases.slug, slug));

  revalidatePath('/tests');
  return { ok: true };
}

export async function addFeedback(slug: string, feedback: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db
    .update(useCases)
    .set({ feedback: feedback || null, updatedAt: new Date() })
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
