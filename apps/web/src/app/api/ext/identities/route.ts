import { NextResponse } from 'next/server';
import { and, desc, eq, or, inArray } from 'drizzle-orm';
import { getDb, identities, identityProjects } from '@mos2/db';
import { checkAuth } from '../_auth';
import { encryptValue } from '@/lib/crypto';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// GET /api/ext/identities?projectId=&kind=
// List identity presets (slim) cho picker — KHÔNG trả password/email plain.
export async function GET(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;
  const sp = new URL(req.url).searchParams;
  const projectId = (sp.get('projectId') ?? '').trim();
  const kind = (sp.get('kind') ?? '').trim();
  if (!projectId) return errorResponse('projectId required', 400);

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  // multi-project: persona link với projectId qua pivot identity_projects
  // (home project_id fallback cho hàng chưa backfill).
  const linked = db.select({ id: identityProjects.identityId }).from(identityProjects).where(eq(identityProjects.projectId, projectId));
  const inProject = or(inArray(identities.id, linked), eq(identities.projectId, projectId));
  const raw = await db
    .select({
      id: identities.id, name: identities.name, kind: identities.kind,
      handleBase: identities.handleBase, displayName: identities.displayName,
      passwordEnc: identities.passwordEnc,
    })
    .from(identities)
    .where(kind ? and(inProject, eq(identities.kind, kind)) : inProject)
    .orderBy(desc(identities.updatedAt));
  // Slim + an toàn: cờ hasPassword (boolean) cho picker hiện pwd:✓, KHÔNG ship
  // ciphertext/email plain (email lộ sau reveal khi user chủ động chọn).
  const rows = raw.map(({ passwordEnc, ...r }) => ({ ...r, hasPassword: !!passwordEnc }));
  return NextResponse.json({ ok: true, identities: rows });
}

// POST /api/ext/identities { projectId, name, kind?, handleBase?, email?, password?,
//   displayName?, bio?, avatarUrl?, persona?, customFields? }
export async function POST(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = String(body.projectId ?? '').trim();
  const name = String(body.name ?? '').trim();
  if (!projectId || !name) {
    return errorResponse('projectId + name required', 400);
  }
  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const pw = body.password ? String(body.password) : '';
  const passwordEnc = pw ? await encryptValue(pw) : null;
  const pwVars = Array.isArray(body.passwordVariants) ? (body.passwordVariants as unknown[]).map((x) => String(x)).filter(Boolean) : [];
  const passwordVariantsEnc = pwVars.length ? await encryptValue(JSON.stringify(pwVars)) : null;

  const inserted = await db.insert(identities).values({
    projectId,
    name,
    kind: body.kind === 'brand' ? 'brand' : 'seeding',
    handleBase: String(body.handleBase ?? ''),
    email: String(body.email ?? ''),
    passwordEnc,
    passwordVariantsEnc,
    displayName: String(body.displayName ?? ''),
    bio: String(body.bio ?? ''),
    avatarUrl: String(body.avatarUrl ?? ''),
    persona: (body.persona && typeof body.persona === 'object') ? body.persona as object : {},
    customFields: (body.customFields && typeof body.customFields === 'object') ? body.customFields as object : {},
    fieldVariants: (body.fieldVariants && typeof body.fieldVariants === 'object') ? body.fieldVariants as object : {},
  }).returning({ id: identities.id });

  const newId = inserted[0]?.id;
  // pivot 'primary' cho home project (multi-project: thêm project khác ở studio).
  if (newId) await db.insert(identityProjects).values({ projectId, identityId: newId, role: 'primary' }).onConflictDoNothing();
  return NextResponse.json({ ok: true, id: newId });
}
