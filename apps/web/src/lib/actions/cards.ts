'use server';

// Server Actions for Command Board card mutations.
// All actions assume DB present — callers should not invoke from mock-only mode.
// Tenant filter is implicit via DEFAULT_TENANT_ID.

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured — server actions require DB.');
  return db;
}

async function findCard(projectId: string, cardRef: string) {
  const db = ensureDb();
  const rows = await db
    .select()
    .from(cards)
    .where(and(eq(cards.tenantId, TENANT), eq(cards.projectId, projectId), eq(cards.cardRef, cardRef)))
    .limit(1);
  return rows[0] ?? null;
}

export async function moveCard(projectId: string, cardRef: string, newCol: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const card = await findCard(projectId, cardRef);
  if (!card) return { ok: false, error: 'card not found' };

  await db
    .update(cards)
    .set({ col: newCol, updatedAt: new Date() })
    .where(eq(cards.id, card.id));

  revalidatePath(`/p/${projectId}/board`);
  revalidatePath(`/p/${projectId}`);
  return { ok: true };
}

export async function approveCard(projectId: string, cardRef: string): Promise<{ ok: boolean; error?: string }> {
  return moveCard(projectId, cardRef, 'approved');
}

export async function rejectCard(projectId: string, cardRef: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const card = await findCard(projectId, cardRef);
  if (!card) return { ok: false, error: 'card not found' };

  // Reject = soft-archive (keeps row, hides from listings via archivedAt filter).
  await db
    .update(cards)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(cards.id, card.id));

  revalidatePath(`/p/${projectId}/board`);
  revalidatePath(`/p/${projectId}`);
  return { ok: true };
}

export async function escalateCard(projectId: string, cardRef: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const card = await findCard(projectId, cardRef);
  if (!card) return { ok: false, error: 'card not found' };

  await db
    .update(cards)
    .set({ col: 'escalated', level: 4, urgent: true, updatedAt: new Date() })
    .where(eq(cards.id, card.id));

  revalidatePath(`/p/${projectId}/board`);
  revalidatePath(`/p/${projectId}`);
  return { ok: true };
}
