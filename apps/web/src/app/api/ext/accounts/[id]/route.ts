import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, platformAccounts } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { pushAccountToDirectus } from '@/lib/actions/accounts';

export const dynamic = 'force-dynamic';

// GET /api/ext/accounts/[id]?reveal=1 → account (password plain CHỈ khi reveal=1).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = checkAuth(req);
  if (err) return err;
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
  const { id } = await params;
  const reveal = new URL(req.url).searchParams.get('reveal') === '1';
  const [r] = await db
    .select({
      id: platformAccounts.id, projectId: platformAccounts.projectId, platformKey: platformAccounts.platformKey,
      handle: platformAccounts.handle, email: platformAccounts.email, status: platformAccounts.status,
      notes: platformAccounts.notes, persona: platformAccounts.persona, passwordEnc: platformAccounts.passwordEnc,
    })
    .from(platformAccounts)
    .where(eq(platformAccounts.id, Number(id)))
    .limit(1);
  if (!r) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  const password = reveal && r.passwordEnc ? await decryptValue(r.passwordEnc) : undefined;
  const { passwordEnc, ...rest } = r;
  return NextResponse.json({
    ok: true,
    account: { ...rest, hasPassword: !!passwordEnc, ...(reveal ? { password: password ?? '' } : {}) },
  });
}

// PATCH /api/ext/accounts/[id]
// Body: { notes?, handle?, email?, status?, password?, personaUpdates?, checklistUpdates? }
// password → mã hoá vào password_enc (KHÔNG lưu plain). personaUpdates merge JSONB.
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
    password?: string;
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
  // password → password_enc (mã hoá). '' = xoá. undefined = giữ nguyên.
  if (body.password !== undefined) {
    set.passwordEnc = body.password ? await encryptValue(body.password) : null;
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

  // Reverse-sync → Directus (fire-and-forget) khi field account đổi (bỏ qua checklist thuần).
  if (body.handle !== undefined || body.email !== undefined || body.status !== undefined || body.password !== undefined || body.personaUpdates) {
    try {
      const [acc] = await db.select({ projectId: platformAccounts.projectId }).from(platformAccounts).where(eq(platformAccounts.id, accountId)).limit(1);
      if (acc?.projectId) pushAccountToDirectus(acc.projectId, accountId).catch(() => {});
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true });
}
