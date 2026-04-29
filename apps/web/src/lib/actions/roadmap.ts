'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, roadmapItems } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export type RoadmapStatus = 'backlog' | 'planned' | 'in-progress' | 'review' | 'done' | 'blocked' | 'dropped';

export async function markRoadmapItem(
  slug: string,
  status: RoadmapStatus,
  statusNote?: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const rows = await db
    .select({ slug: roadmapItems.slug, status: roadmapItems.status, startedAt: roadmapItems.startedAt })
    .from(roadmapItems)
    .where(and(eq(roadmapItems.tenantId, TENANT), eq(roadmapItems.slug, slug)))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'roadmap item not found' };

  const cur = rows[0]!;
  const set: Partial<typeof roadmapItems.$inferInsert> = {
    status,
    statusNote: statusNote ?? null,
    updatedAt: new Date(),
  };
  // Auto-stamp startedAt when transitioning into in-progress for the first time.
  if (status === 'in-progress' && !cur.startedAt) {
    set.startedAt = new Date();
  }
  // Auto-stamp doneAt when status flips to done; clear it otherwise.
  if (status === 'done') {
    set.doneAt = new Date();
  } else if (cur.status === 'done') {
    set.doneAt = null;
  }

  await db.update(roadmapItems).set(set).where(eq(roadmapItems.slug, slug));
  revalidatePath('/roadmap');
  return { ok: true };
}

export async function addRoadmapNote(slug: string, notes: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db
    .update(roadmapItems)
    .set({ notes: notes || null, updatedAt: new Date() })
    .where(eq(roadmapItems.slug, slug));
  revalidatePath('/roadmap');
  return { ok: true };
}

export async function setBlocker(slug: string, blockerRef: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db
    .update(roadmapItems)
    .set({ blockerRef: blockerRef || null, updatedAt: new Date() })
    .where(eq(roadmapItems.slug, slug));
  revalidatePath('/roadmap');
  return { ok: true };
}

// AI calls this after shipping a fix to mark a roadmap item done with the SHA.
export async function markRoadmapShipped(slug: string, commitSha: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db
    .update(roadmapItems)
    .set({ status: 'done', doneAt: new Date(), shippedIn: commitSha, updatedAt: new Date() })
    .where(eq(roadmapItems.slug, slug));
  revalidatePath('/roadmap');
  return { ok: true };
}
