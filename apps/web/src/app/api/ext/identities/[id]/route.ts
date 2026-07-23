import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, identities } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { encryptValue, decryptValue } from '@/lib/crypto';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// GET /api/ext/identities/[id]?reveal=1
// Full identity (persona + custom_fields) để pre-fill form. password CHỈ trả
// khi ?reveal=1 (decrypt just-in-time, auth = ext key = admin).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;
  const { id } = await params;
  const reveal = new URL(req.url).searchParams.get('reveal') === '1';

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const rows = await db.select().from(identities).where(eq(identities.id, Number(id))).limit(1);
  const r = rows[0];
  if (!r) return errorResponse('not found', 404);

  const password = reveal && r.passwordEnc ? await decryptValue(r.passwordEnc) : undefined;
  let passwordVariants: string[] = [];
  if (reveal && r.passwordVariantsEnc) { try { passwordVariants = (JSON.parse(await decryptValue(r.passwordVariantsEnc)) as string[]) || []; } catch { /* ignore */ } }
  return NextResponse.json({
    ok: true,
    identity: {
      id: r.id, projectId: r.projectId, name: r.name, kind: r.kind,
      handleBase: r.handleBase, email: r.email, displayName: r.displayName,
      bio: r.bio, avatarUrl: r.avatarUrl, persona: r.persona, customFields: r.customFields,
      // Backups per field (mig 0087) → ext switch / auto-pick khi platform khác ràng buộc.
      fieldVariants: (r.fieldVariants as Record<string, string[]>) ?? {},
      hasPassword: !!r.passwordEnc,
      hasPasswordVariants: !!r.passwordVariantsEnc,
      ...(reveal ? { password: password ?? '', passwordVariants } : {}),
    },
  });
}

// PATCH /api/ext/identities/[id] — update fields (password → re-encrypt).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.kind !== undefined) patch.kind = (['personal', 'brand', 'seeding'] as const).includes(body.kind as 'personal' | 'brand' | 'seeding') ? String(body.kind) : 'seeding';
  if (body.handleBase !== undefined) patch.handleBase = String(body.handleBase);
  if (body.email !== undefined) patch.email = String(body.email);
  if (body.displayName !== undefined) patch.displayName = String(body.displayName);
  if (body.bio !== undefined) patch.bio = String(body.bio);
  if (body.avatarUrl !== undefined) patch.avatarUrl = String(body.avatarUrl);
  if (body.persona !== undefined && typeof body.persona === 'object') patch.persona = body.persona;
  if (body.customFields !== undefined && typeof body.customFields === 'object') patch.customFields = body.customFields;
  if (body.fieldVariants !== undefined && typeof body.fieldVariants === 'object') patch.fieldVariants = body.fieldVariants;
  if (body.password !== undefined) {
    const pw = String(body.password);
    patch.passwordEnc = pw ? await encryptValue(pw) : null;
  }
  // Password backups → mã hoá JSON array (như password_enc). [] = xoá.
  if (body.passwordVariants !== undefined && Array.isArray(body.passwordVariants)) {
    const arr = (body.passwordVariants as unknown[]).map((x) => String(x)).filter(Boolean);
    patch.passwordVariantsEnc = arr.length ? await encryptValue(JSON.stringify(arr)) : null;
  }

  await db.update(identities).set(patch).where(eq(identities.id, Number(id)));
  return NextResponse.json({ ok: true });
}

// DELETE /api/ext/identities/[id] → xoá identity (persona lỗi/trùng). admin-only
// (deniedForStaff chặn mọi method DELETE cho staff token). identity_projects.identity_id CASCADE;
// platform_accounts.persona.identityId = soft-ref (no FK) → để dangling, không chặn xoá.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;
  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return errorResponse('bad id', 400);
  const [row] = await db.select({ id: identities.id }).from(identities).where(eq(identities.id, idNum)).limit(1);
  if (!row) return errorResponse('not found', 404);
  try {
    await db.delete(identities).where(eq(identities.id, idNum));
  } catch (e) {
    return errorResponse('delete failed (FK?): ' + (e instanceof Error ? e.message : String(e)), 409);
  }
  return NextResponse.json({ ok: true, id: idNum });
}
