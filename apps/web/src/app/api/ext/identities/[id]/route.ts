import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, identities } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { encryptValue, decryptValue } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// GET /api/ext/identities/[id]?reveal=1
// Full identity (persona + custom_fields) để pre-fill form. password CHỈ trả
// khi ?reveal=1 (decrypt just-in-time, auth = ext key = admin).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = checkAuth(req);
  if (err) return err;
  const { id } = await params;
  const reveal = new URL(req.url).searchParams.get('reveal') === '1';

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const rows = await db.select().from(identities).where(eq(identities.id, Number(id))).limit(1);
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

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
  const err = checkAuth(req);
  if (err) return err;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.kind !== undefined) patch.kind = body.kind === 'brand' ? 'brand' : 'seeding';
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
