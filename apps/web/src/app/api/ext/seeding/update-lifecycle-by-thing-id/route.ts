import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { updateCardLifecycle } from '@/lib/actions/brief-posts';

// POST /api/ext/seeding/update-lifecycle-by-thing-id
// Body: { thingId, lifecycle, note? }
//
// Ext detect "Unauthorized access" trên /commentstats/t1_<id> → comment đã
// bị xoá (mod removed hoặc self-deleted) → ext POST đây thay vì
// /insights-by-thing-id.
//
// Server: tìm card có post_url ILIKE '%/<thingId>/%' → updateCardLifecycle.

const VALID_LIFECYCLES = new Set([
  'live', 'ghosted', 'removed-by-mod', 'self-deleted', 'low-engagement',
]);

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    thingId?: string;
    lifecycle?: string;
    note?: string;
  };

  const thingId = String(body.thingId ?? '').trim().replace(/^t1_/, '');
  if (!thingId || !/^[a-z0-9]{4,12}$/i.test(thingId)) {
    return NextResponse.json({ ok: false, error: 'thingId required (alphanum)' }, { status: 400 });
  }
  if (!body.lifecycle || !VALID_LIFECYCLES.has(body.lifecycle)) {
    return NextResponse.json({
      ok: false,
      error: `Invalid lifecycle. Valid: ${[...VALID_LIFECYCLES].join(', ')}`,
    }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // Tìm card khớp thingId. Pattern .../comments/<post>/<slug>/<thingId>/
  const pattern = `%/${thingId}/%`;
  const rows = await db.execute(sql`
    SELECT id, post_url FROM cards
    WHERE post_url ILIKE ${pattern}
      AND archived_at IS NULL
    ORDER BY posted_at DESC NULLS LAST
    LIMIT 1
  `);
  const card = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!card) {
    return NextResponse.json({
      ok: false,
      error: `Không tìm thấy card khớp /${thingId}/`,
    }, { status: 404 });
  }

  const cardId = Number(card.id);
  const res = await updateCardLifecycle(
    cardId,
    body.lifecycle as 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement',
    body.note ?? null,
  );
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, cardId, lifecycle: body.lifecycle });
}
