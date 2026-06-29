import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { updateCardLifecycle } from '@/lib/actions/brief-posts';
import { LIFECYCLE_VALUES } from '@/lib/lifecycle';
import { canonPlatformKey, detectPlatformKeyFromUrl } from '@/lib/habitat-platform-map';
import { normalizeThingId, isValidThingId, postUrlSearchPattern, threadFallback } from '@/lib/platform-url-parsers';
import { firstRow, errorResponse } from '@/lib/ext-route';

// POST /api/ext/seeding/update-lifecycle-by-thing-id
// Body: { thingId, lifecycle, note? }
//
// Ext detect "Unauthorized access" trên /commentstats/t1_<id> → comment đã
// bị xoá (mod removed hoặc self-deleted) → ext POST đây thay vì
// /insights-by-thing-id.
//
// Server: tìm card có post_url ILIKE '%/<thingId>/%' → updateCardLifecycle.

const VALID_LIFECYCLES = new Set<string>(LIFECYCLE_VALUES);   // 1 source: lib/lifecycle.ts

export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    thingId?: string;
    lifecycle?: string;
    note?: string;
    commentUrl?: string;   // full permalink comment đang xem → fallback match theo thread + backfill post_url
    handle?: string;       // viewer handle → thu hẹp đúng account khi fallback
    platformKey?: string;  // x/reddit/bsky…; thiếu → suy từ commentUrl host, mặc định reddit
  };

  // Platform suy từ body.platformKey → commentUrl host → mặc định reddit (back-compat).
  const pk = canonPlatformKey(body.platformKey) || detectPlatformKeyFromUrl(String(body.commentUrl ?? '')) || 'reddit';
  const thingId = normalizeThingId(pk, String(body.thingId ?? ''));
  if (!thingId || !isValidThingId(pk, thingId)) {
    return errorResponse('thingId required (valid id for platform)', 400);
  }
  if (!body.lifecycle || !VALID_LIFECYCLES.has(body.lifecycle)) {
    return errorResponse(`Invalid lifecycle. Valid: ${[...VALID_LIFECYCLES].join(', ')}`, 400);
  }

  const db = getDb();
  if (!db) return errorResponse('DATABASE_URL not configured', 503);

  // Tìm card khớp thingId. Pattern theo platform (Reddit: .../<thingId>/; X: /status/<id>).
  const pattern = postUrlSearchPattern(pk, thingId);
  const rows = await db.execute(sql`
    SELECT id, post_url FROM cards
    WHERE post_url ILIKE ${pattern}
      AND archived_at IS NULL
    ORDER BY posted_at DESC NULLS LAST
    LIMIT 1
  `);
  let card = firstRow(rows);

  // FALLBACK: không card nào có post_url chứa thingId (comment đăng tay, hoặc track bắt nhầm
  // comment khác) → match theo THREAD (parent_url) + account (handle nếu có), rồi BACKFILL
  // post_url = comment permalink thật. Để lifecycle chạy trên mọi comment của thread đã seed.
  let backfilled = false;
  if (!card && body.commentUrl) {
    const tf = threadFallback(pk, String(body.commentUrl));
    const handle = (body.handle ?? '').replace(/^u\//i, '').replace(/^@/, '').toLowerCase();
    if (tf) {
      const threadPat = tf.pattern;
      const rows2 = await db.execute(sql`
        SELECT c.id FROM cards c
        LEFT JOIN community_briefs b ON b.id = c.brief_id
        LEFT JOIN platform_accounts pa ON pa.id = COALESCE(c.account_id, b.account_id)
        WHERE c.archived_at IS NULL
          AND c.parent_url ILIKE ${threadPat}
          ${handle ? sql`AND lower(pa.handle) = ${handle}` : sql``}
        ORDER BY (c.post_url IS NOT NULL) DESC, c.posted_at DESC NULLS LAST, c.id DESC
        LIMIT 1
      `);
      const c2 = firstRow(rows2);
      if (c2) {
        await db.execute(sql`
          UPDATE cards SET post_url = ${body.commentUrl}, posted_at = COALESCE(posted_at, now()), updated_at = now()
          WHERE id = ${Number(c2.id)}
        `);
        card = c2;
        backfilled = true;
      }
    }
  }

  if (!card) {
    return errorResponse(`Không tìm thấy card khớp /${thingId}/ (và không có card nào cho thread này). Comment này chưa được seed qua MOS2?`, 404);
  }

  const cardId = Number(card.id);
  const res = await updateCardLifecycle(
    cardId,
    body.lifecycle as 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement',
    body.note ?? null,
  );
  if (!res.ok) return errorResponse(res.error, 500);
  return NextResponse.json({ ok: true, cardId, lifecycle: body.lifecycle, backfilled });
}
