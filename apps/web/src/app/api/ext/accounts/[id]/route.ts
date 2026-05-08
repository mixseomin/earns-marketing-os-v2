import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, platformAccounts } from '@mos2/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// PATCH /api/ext/accounts/[id]
// Body: { notes?, handle?, personaUpdates? }
// personaUpdates: partial dict merged into existing persona JSONB.
// Used by extension to save inline-edited snippet text or persona fields.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const { id } = await params;
  const accountId = Number(id);
  const body = await req.json() as {
    notes?: string;
    handle?: string;
    email?: string;
    status?: string;
    personaUpdates?: Record<string, string | null>;
    checklistUpdates?: Record<string, { done: boolean }>;
  };

  const VALID_STATUSES = ['todo', 'creating', 'warming', 'active', 'limited', 'blocked', 'banned'];
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (body.notes !== undefined) set.notes = body.notes;
  if (body.handle !== undefined) set.handle = body.handle;
  if (body.email !== undefined) set.email = body.email;
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status (must be one of ${VALID_STATUSES.join('|')})` }, { status: 400 });
    }
    set.status = body.status;
  }

  if (body.checklistUpdates) {
    const [existing] = await db
      .select({ warmupChecklist: platformAccounts.warmupChecklist })
      .from(platformAccounts)
      .where(eq(platformAccounts.id, accountId))
      .limit(1);
    const current = (existing?.warmupChecklist as Record<string, { done?: boolean; updatedAt?: string }>) ?? {};
    const merged: Record<string, { done?: boolean; updatedAt?: string }> = { ...current };
    for (const [k, v] of Object.entries(body.checklistUpdates)) {
      merged[k] = { ...(merged[k] ?? {}), done: v.done, updatedAt: new Date().toISOString() };
    }
    set.warmupChecklist = merged;
  }

  if (body.personaUpdates) {
    const [existing] = await db
      .select({ persona: platformAccounts.persona })
      .from(platformAccounts)
      .where(eq(platformAccounts.id, accountId))
      .limit(1);
    const current = (existing?.persona as Record<string, string>) ?? {};
    const merged: Record<string, string> = { ...current };
    for (const [k, v] of Object.entries(body.personaUpdates)) {
      if (v === null || v === '') delete merged[k]; // null = remove override
      else merged[k] = v;
    }
    set.persona = merged;
  }

  await db
    .update(platformAccounts)
    .set(set)
    .where(eq(platformAccounts.id, accountId));

  return NextResponse.json({ ok: true });
}
