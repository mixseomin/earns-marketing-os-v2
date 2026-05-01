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

// ── Create / Update / Delete ────────────────────────────────────

export interface CardInput {
  title: string;
  col: string;
  squadKey: string;
  level: 1 | 2 | 3 | 4;
  money?: string | null;
  due: string;
  urgent?: boolean;
  tags: string[];
  agentRef?: string | null;
  agentKind?: string | null;       // Phase 10: dispatch enum (gpt-4o-mini | claude-haiku-4-5 | claude-code | human | null)
  idempotencyKey?: string | null;  // Phase 10: anti double-exec
  body?: string | null;
}

function genCardRef(prefix: string): string {
  // OFR-2891 style. Random 4-digit + prefix from squad/col.
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix.toUpperCase().slice(0, 3)}-${n}`;
}

export async function createCard(projectId: string, input: CardInput): Promise<{ ok: boolean; cardRef?: string; error?: string }> {
  const db = ensureDb();
  if (!input.title.trim()) return { ok: false, error: 'Title không được rỗng' };

  let ref = genCardRef(input.squadKey || 'CRD');
  // Ensure unique within project (rare collision retry).
  for (let i = 0; i < 5; i++) {
    const ex = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.projectId, projectId), eq(cards.cardRef, ref)))
      .limit(1);
    if (ex.length === 0) break;
    ref = genCardRef(input.squadKey || 'CRD');
  }

  await db.insert(cards).values({
    tenantId: TENANT,
    projectId,
    cardRef: ref,
    col: input.col,
    title: input.title.trim(),
    squadKey: input.squadKey,
    level: input.level,
    money: input.money ?? null,
    due: input.due || '—',
    urgent: !!input.urgent,
    tags: input.tags ?? [],
    agentRef: input.agentRef ?? null,
    agentKind: input.agentKind ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    body: input.body ?? null,
  });

  revalidatePath(`/p/${projectId}/board`);
  revalidatePath(`/p/${projectId}`);
  return { ok: true, cardRef: ref };
}

export async function updateCard(projectId: string, cardRef: string, patch: Partial<CardInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const card = await findCard(projectId, cardRef);
  if (!card) return { ok: false, error: 'card not found' };

  const set: Partial<typeof cards.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title.trim();
  if (patch.col !== undefined) set.col = patch.col;
  if (patch.squadKey !== undefined) set.squadKey = patch.squadKey;
  if (patch.level !== undefined) set.level = patch.level;
  if (patch.money !== undefined) set.money = patch.money;
  if (patch.due !== undefined) set.due = patch.due || '—';
  if (patch.urgent !== undefined) set.urgent = !!patch.urgent;
  if (patch.tags !== undefined) set.tags = patch.tags;
  if (patch.agentRef !== undefined) set.agentRef = patch.agentRef;
  if (patch.agentKind !== undefined) set.agentKind = patch.agentKind;
  if (patch.idempotencyKey !== undefined) set.idempotencyKey = patch.idempotencyKey;
  if (patch.body !== undefined) set.body = patch.body;

  await db.update(cards).set(set).where(eq(cards.id, card.id));

  revalidatePath(`/p/${projectId}/board`);
  revalidatePath(`/p/${projectId}`);
  return { ok: true };
}

export async function deleteCard(projectId: string, cardRef: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const card = await findCard(projectId, cardRef);
  if (!card) return { ok: false, error: 'card not found' };

  await db.delete(cards).where(eq(cards.id, card.id));
  revalidatePath(`/p/${projectId}/board`);
  revalidatePath(`/p/${projectId}`);
  return { ok: true };
}
