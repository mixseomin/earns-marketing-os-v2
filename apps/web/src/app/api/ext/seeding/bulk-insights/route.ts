import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

// POST /api/ext/seeding/bulk-insights
// Body: { items: [{ thingId, score?, replyCount?, views?, upvoteRatio?, postUrl? }, ...] }
//
// Use case: ext scrape Reddit user profile (/user/<handle>/.json) → trả 100
// items với score + num_comments cho mỗi comment/post user → bulk update
// insights vào MOS2 cards 1 round-trip.
//
// Flow per item:
//   1. Find card.id WHERE post_url ILIKE '%/<thingId>/%' (existing card).
//   2. Hit → UPDATE insights_score / insights_reply_count / ... + fetched_at.
//   3. Miss → skip (KHÔNG auto-create vì batch mode dễ tạo ghost cards mass).
//      User dùng endpoint single insights-by-thing-id để auto-create case-by-case.
//
// Trả summary { updated, skipped, notFound }.

interface BulkItem {
  thingId?: string;
  score?: number;
  replyCount?: number;
  views?: number;
  upvoteRatio?: number;
  awardCount?: number;
  postUrl?: string;            // chỉ log, không dùng để create
}

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as { items?: BulkItem[] };
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'items array required' }, { status: 400 });
  }
  if (items.length > 200) {
    return NextResponse.json({ ok: false, error: 'max 200 items per batch' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  const results: Array<{ thingId: string; status: 'updated' | 'not_found' | 'skipped'; cardId?: number; error?: string }> = [];

  for (const it of items) {
    const thingId = String(it.thingId ?? '').trim().replace(/^t1_/, '').replace(/^t3_/, '');
    if (!thingId || !/^[a-z0-9]{4,12}$/i.test(thingId)) {
      results.push({ thingId: String(it.thingId ?? ''), status: 'skipped', error: 'invalid thingId' });
      continue;
    }
    const pattern = `%/${thingId}/%`;
    const rows = await db.execute(sql`
      SELECT id FROM cards
      WHERE post_url ILIKE ${pattern}
        AND archived_at IS NULL
      ORDER BY posted_at DESC NULLS LAST
      LIMIT 1
    `);
    const cardRow = (rows as unknown as Array<{ id: number }>)[0];
    if (!cardRow) {
      results.push({ thingId, status: 'not_found' });
      continue;
    }

    const sets: ReturnType<typeof sql>[] = [];
    if (it.score != null) sets.push(sql`insights_score = ${Math.round(Number(it.score))}`);
    if (it.replyCount != null) sets.push(sql`insights_reply_count = ${Math.round(Number(it.replyCount))}`);
    if (it.views != null) sets.push(sql`insights_views_count = ${Math.round(Number(it.views))}`);
    if (it.upvoteRatio != null) {
      const r = Math.max(0, Math.min(1, Number(it.upvoteRatio)));
      sets.push(sql`insights_upvote_ratio = ${r}`);
    }
    if (it.awardCount != null) sets.push(sql`insights_award_count = ${Math.round(Number(it.awardCount))}`);
    if (sets.length === 0) {
      results.push({ thingId, status: 'skipped', cardId: cardRow.id, error: 'no insight fields' });
      continue;
    }
    sets.push(sql`insights_fetched_at = NOW()`);
    sets.push(sql`updated_at = NOW()`);
    const setClause = sql.join(sets, sql`, `);
    await db.execute(sql`UPDATE cards SET ${setClause} WHERE id = ${cardRow.id}`);
    results.push({ thingId, status: 'updated', cardId: cardRow.id });
  }

  const updated = results.filter((r) => r.status === 'updated').length;
  const notFound = results.filter((r) => r.status === 'not_found').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  return NextResponse.json({
    ok: true,
    summary: { total: items.length, updated, notFound, skipped },
    results,
  });
}
