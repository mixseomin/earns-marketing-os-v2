import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, platformAccounts } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { upsertDirectusAccountByHandle, deleteDirectusAccountByHandle } from '@/lib/bridge/directus';
import { canonField } from '@/lib/selector-field-canon';

export const dynamic = 'force-dynamic';

// DELETE /api/ext/accounts/[id] → xoá account (dùng khi tạo nhầm / lỗi đăng ký).
// FK: community_briefs/project_accounts/account_grants CASCADE, cards.brief_id SET NULL
// (content cards GIỮ LẠI, chỉ unlink), human_tasks.account_id SET NULL. + xoá Directus mirror.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = checkAuth(req);
  if (err) return err;
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isFinite(accountId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });
  // Lấy handle+platform TRƯỚC khi xoá để xoá đúng mirror Directus.
  const [acc] = await db
    .select({ platformKey: platformAccounts.platformKey, handle: platformAccounts.handle })
    .from(platformAccounts)
    .where(eq(platformAccounts.id, accountId))
    .limit(1);
  if (!acc) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  await db.delete(platformAccounts).where(eq(platformAccounts.id, accountId));
  let directusDeleted = 0;
  try { if (acc.handle) directusDeleted = (await deleteDirectusAccountByHandle(acc.platformKey, acc.handle)).deleted; } catch { /* non-blocking */ }
  return NextResponse.json({ ok: true, id: accountId, handle: acc.handle, platformKey: acc.platformKey, directusDeleted });
}

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
    followUpAt?: string | null;
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
  // follow_up_at: ngày hẹn check lại (chờ verify/duyệt). '' / null = xoá hẹn.
  if (body.followUpAt !== undefined) {
    set.followUpAt = body.followUpAt ? new Date(body.followUpAt) : null;
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
    for (const [rawK, v] of Object.entries(body.personaUpdates)) {
      // Canon key through the ONE normalizer so persona['About']/'about' converge with
      // selector field_names — kills persona['field'] vs ['about'] drift at the write
      // boundary. identityId is config (camelCase), not a profile field → keep as-is.
      const k = rawK === 'identityId' ? rawK : canonField(rawK, 'signup');
      if (!k) continue;
      if (v === null || v === '') delete merged[k]; // null = remove override
      else merged[k] = v;
    }
    set.persona = merged;
  }

  await db
    .update(platformAccounts)
    .set(set)
    .where(eq(platformAccounts.id, accountId));

  // Reverse-sync → Directus (await, non-fatal) khi field account đổi (bỏ qua checklist thuần).
  if (body.handle !== undefined || body.email !== undefined || body.status !== undefined || body.personaUpdates) {
    try {
      const [acc] = await db.select({ platformKey: platformAccounts.platformKey, handle: platformAccounts.handle, email: platformAccounts.email, status: platformAccounts.status, notes: platformAccounts.notes }).from(platformAccounts).where(eq(platformAccounts.id, accountId)).limit(1);
      if (acc?.handle) await upsertDirectusAccountByHandle({ platformKey: acc.platformKey, handle: acc.handle, email: acc.email, status: acc.status, notes: acc.notes });
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true });
}
