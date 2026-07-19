// GET /api/dom-sample/[id] — view a captured DOM sample's raw HTML as text (view-source style, so
// the captured page's scripts never execute). Lets the person doing/checking a backlink task see the
// real page structure the instructions were grounded on. Any authenticated user (staff included).
import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return new NextResponse('forbidden', { status: 403 });
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n)) return new NextResponse('bad id', { status: 400 });
  const db = getDb();
  if (!db) return new NextResponse('no db', { status: 503 });
  const rows = (await db.execute(sql`
    SELECT hostname, url, page_kind, title, captured_at, html FROM dom_samples WHERE id = ${n} LIMIT 1
  `)) as unknown as Array<{ hostname: string; url: string; page_kind: string; title: string; captured_at: string; html: string }>;
  const r = rows[0];
  if (!r) return new NextResponse('not found', { status: 404 });
  const header = `# DOM sample #${n}\n# host: ${r.hostname}\n# page: ${r.page_kind}\n# url: ${r.url}\n# title: ${r.title || ''}\n# captured: ${r.captured_at}\n\n`;
  return new NextResponse(header + (r.html || ''), {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store' },
  });
}
