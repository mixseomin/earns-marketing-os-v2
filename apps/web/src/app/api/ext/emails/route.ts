import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb, emails } from '@mos2/db';
import { checkAuth } from '../_auth';

export const dynamic = 'force-dynamic';

// GET /api/ext/emails?status=active → thư viện email (H1).
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  const status = (new URL(req.url).searchParams.get('status') ?? '').trim();
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  const base = db
    .select({ id: emails.id, email: emails.email, provider: emails.provider, status: emails.status, label: emails.label })
    .from(emails);
  const rows = await (status ? base.where(eq(emails.status, status)) : base).orderBy(desc(emails.updatedAt));
  return NextResponse.json({ ok: true, emails: rows });
}

// POST /api/ext/emails { email, provider?, label?, notes? }
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const email = String(body.email ?? '').trim();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'email hợp lệ required' }, { status: 400 });
  }
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  // provider auto từ domain nếu không truyền.
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const provider = body.provider ? String(body.provider) : (domain === 'gmail.com' || domain === 'googlemail.com' ? 'gmail' : 'other');
  try {
    const inserted = await db.insert(emails).values({
      email, provider,
      label: String(body.label ?? ''), notes: String(body.notes ?? ''),
    }).onConflictDoNothing().returning({ id: emails.id });
    if (!inserted[0]) return NextResponse.json({ ok: false, error: 'email đã tồn tại' }, { status: 409 });
    return NextResponse.json({ ok: true, id: inserted[0].id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'insert fail' }, { status: 500 });
  }
}
