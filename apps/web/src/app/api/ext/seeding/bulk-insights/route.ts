import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { appendInsightsSnapshot, insightsScalarSets } from '@/lib/insights-snapshot';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { normalizeThingId, isValidThingId, postUrlSearchPattern } from '@/lib/platform-url-parsers';
import { firstRow, errorResponse } from '@/lib/ext-route';

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
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as { items?: BulkItem[]; platformKey?: string };
  // Batch theo 1 platform (profile scrape). Thiếu → reddit (back-compat: dùng case duy nhất hiện tại).
  const pk = canonPlatformKey(body.platformKey) || 'reddit';
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return errorResponse('items array required', 400);
  }
  if (items.length > 200) {
    return errorResponse('max 200 items per batch', 400);
  }

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  const results: Array<{ thingId: string; status: 'updated' | 'not_found' | 'skipped'; cardId?: number; error?: string }> = [];

  for (const it of items) {
    const thingId = normalizeThingId(pk, String(it.thingId ?? ''));
    if (!thingId || !isValidThingId(pk, thingId)) {
      results.push({ thingId: String(it.thingId ?? ''), status: 'skipped', error: 'invalid thingId' });
      continue;
    }
    const pattern = postUrlSearchPattern(pk, thingId);
    const rows = await db.execute(sql`
      SELECT id FROM cards
      WHERE post_url ILIKE ${pattern}
        AND archived_at IS NULL
      ORDER BY posted_at DESC NULLS LAST
      LIMIT 1
    `);
    const cardRow = firstRow<{ id: number }>(rows);
    if (!cardRow) {
      results.push({ thingId, status: 'not_found' });
      continue;
    }

    const sets: ReturnType<typeof sql>[] = [];
    sets.push(...insightsScalarSets(it));
    if (sets.length === 0) {
      results.push({ thingId, status: 'skipped', cardId: cardRow.id, error: 'no insight fields' });
      continue;
    }
    sets.push(sql`insights_fetched_at = NOW()`);
    sets.push(sql`updated_at = NOW()`);
    const setClause = sql.join(sets, sql`, `);
    await db.execute(sql`UPDATE cards SET ${setClause} WHERE id = ${cardRow.id}`);
    await appendInsightsSnapshot(db, Number(cardRow.id));   // 0093: time-series (throttled, non-fatal)
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
