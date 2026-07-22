import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb, emailOffers, projects } from '@mos2/db';
import { eq, ilike, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// A sending domain maps to a project by matching the project's website to the root domain,
// e.g. news.militarycalc.com → militarycalc.com → project "militarycalc".
async function projectForDomain(db: NonNullable<ReturnType<typeof getDb>>, domain: string) {
  const root = domain.split('.').slice(-2).join('.');
  if (!root) return null;
  const rows = await db.select({ id: projects.id, name: projects.name }).from(projects).where(ilike(projects.website, `%${root}%`)).limit(1);
  return rows[0] || null;
}

// GET ?domain= — offers for the domain's project (filter + show by project). Admin-only.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const domain = (req.nextUrl.searchParams.get('domain') || '').trim().toLowerCase();
  const project = domain ? await projectForDomain(db, domain) : null;
  if (!project) return NextResponse.json({ project: null, offers: [] });

  const offers = await db.select().from(emailOffers).where(eq(emailOffers.projectId, project.id)).orderBy(desc(emailOffers.createdAt));
  return NextResponse.json({ project, offers }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST { domain, label, url, interest } — add a reusable offer to the domain's project.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as { domain?: string; label?: string; url?: string; interest?: string };
  const label = (b.label || '').trim();
  const url = (b.url || '').trim();
  if (!label || !url) return NextResponse.json({ error: 'label and url are required' }, { status: 400 });
  const project = await projectForDomain(db, (b.domain || '').trim().toLowerCase());
  if (!project) return NextResponse.json({ error: 'No project maps to this domain — set the project website first' }, { status: 400 });

  const [row] = await db.insert(emailOffers).values({ projectId: project.id, label, url, interest: (b.interest || '').trim() }).returning();
  return NextResponse.json({ offer: row });
}

// DELETE ?id= — remove an offer.
export async function DELETE(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const id = Number(req.nextUrl.searchParams.get('id') || 0);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await db.delete(emailOffers).where(eq(emailOffers.id, id));
  return NextResponse.json({ ok: true });
}
