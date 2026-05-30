import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, identities } from '@mos2/db';
import { checkAuth } from '../_auth';
import { encryptValue } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// GET /api/ext/identities?projectId=&kind=
// List identity presets (slim) cho picker — KHÔNG trả password/email plain.
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  const sp = new URL(req.url).searchParams;
  const projectId = (sp.get('projectId') ?? '').trim();
  const kind = (sp.get('kind') ?? '').trim();
  if (!projectId) return NextResponse.json({ ok: false, error: 'projectId required' }, { status: 400 });

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const raw = await db
    .select({
      id: identities.id, name: identities.name, kind: identities.kind,
      handleBase: identities.handleBase, displayName: identities.displayName,
      passwordEnc: identities.passwordEnc,
    })
    .from(identities)
    .where(kind
      ? and(eq(identities.projectId, projectId), eq(identities.kind, kind))
      : eq(identities.projectId, projectId))
    .orderBy(desc(identities.updatedAt));
  // Slim + an toàn: cờ hasPassword (boolean) cho picker hiện pwd:✓, KHÔNG ship
  // ciphertext/email plain (email lộ sau reveal khi user chủ động chọn).
  const rows = raw.map(({ passwordEnc, ...r }) => ({ ...r, hasPassword: !!passwordEnc }));
  return NextResponse.json({ ok: true, identities: rows });
}

// POST /api/ext/identities { projectId, name, kind?, handleBase?, email?, password?,
//   displayName?, bio?, avatarUrl?, persona?, customFields? }
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = String(body.projectId ?? '').trim();
  const name = String(body.name ?? '').trim();
  if (!projectId || !name) {
    return NextResponse.json({ ok: false, error: 'projectId + name required' }, { status: 400 });
  }
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const pw = body.password ? String(body.password) : '';
  const passwordEnc = pw ? await encryptValue(pw) : null;

  const inserted = await db.insert(identities).values({
    projectId,
    name,
    kind: body.kind === 'brand' ? 'brand' : 'seeding',
    handleBase: String(body.handleBase ?? ''),
    email: String(body.email ?? ''),
    passwordEnc,
    displayName: String(body.displayName ?? ''),
    bio: String(body.bio ?? ''),
    avatarUrl: String(body.avatarUrl ?? ''),
    persona: (body.persona && typeof body.persona === 'object') ? body.persona as object : {},
    customFields: (body.customFields && typeof body.customFields === 'object') ? body.customFields as object : {},
  }).returning({ id: identities.id });

  return NextResponse.json({ ok: true, id: inserted[0]?.id });
}
