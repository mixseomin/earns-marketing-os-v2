import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

// POST /api/ext/seeding/insights-by-thing-id
// Body: {
//   thingId: string,           // Reddit comment id (vd "oo41qk8") — bỏ prefix t1_
//   views?, score?, upvoteRatio?, replyCount?, shareCount?, awardCount?,
//   rawJson?
// }
//
// Khác /insights ở chỗ KHÔNG yêu cầu cardId. Ext mở Reddit insights page
// (/commentstats/t1_xxx) → scrape DOM → POST đây. Server resolve cardId
// theo post_url chứa thingId (pattern .../comments/<post>/<slug>/<thingId>/).
//
// Tự lưu insights vào card đầu tiên match (1 thingId chỉ thuộc 1 card).
// Nếu không tìm được card → trả ok:false + error để ext show toast warn.

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    thingId?: string;
    views?: number;
    score?: number;
    upvoteRatio?: number;
    replyCount?: number;
    shareCount?: number;
    awardCount?: number;
    rawJson?: unknown;
  };

  const thingId = String(body.thingId ?? '').trim().replace(/^t1_/, '');
  if (!thingId || !/^[a-z0-9]{4,12}$/i.test(thingId)) {
    return NextResponse.json({ ok: false, error: 'thingId required (alphanum)' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // Reddit comment URL pattern: .../comments/<postId>/<slug>/<commentId>/
  // LIKE '%/<thingId>/' tránh false-match với postId trùng.
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
      error: `Không tìm thấy card nào có post_url chứa /${thingId}/. Đảm bảo bài đã được mark-posted.`,
    }, { status: 404 });
  }

  const cardId = Number(card.id);

  // Build SET clause động — chỉ update field user gửi.
  const sets: ReturnType<typeof sql>[] = [];
  if (body.views != null) sets.push(sql`insights_views_count = ${Math.round(Number(body.views))}`);
  if (body.score != null) sets.push(sql`insights_score = ${Math.round(Number(body.score))}`);
  if (body.upvoteRatio != null) {
    const r = Math.max(0, Math.min(1, Number(body.upvoteRatio)));
    sets.push(sql`insights_upvote_ratio = ${r}`);
  }
  if (body.replyCount != null) sets.push(sql`insights_reply_count = ${Math.round(Number(body.replyCount))}`);
  if (body.shareCount != null) sets.push(sql`insights_share_count = ${Math.round(Number(body.shareCount))}`);
  if (body.awardCount != null) sets.push(sql`insights_award_count = ${Math.round(Number(body.awardCount))}`);
  if (body.rawJson) sets.push(sql`insights_raw_json = ${JSON.stringify(body.rawJson)}::jsonb`);
  sets.push(sql`insights_fetched_at = NOW()`);
  sets.push(sql`updated_at = NOW()`);

  if (sets.length === 2) {
    return NextResponse.json({ ok: false, error: 'Không có data insights nào để save' }, { status: 400 });
  }

  const setClause = sql.join(sets, sql`, `);
  await db.execute(sql`UPDATE cards SET ${setClause} WHERE id = ${cardId}`);

  return NextResponse.json({
    ok: true,
    cardId,
    postUrl: String(card.post_url ?? ''),
    fields: {
      views: body.views,
      score: body.score,
      upvoteRatio: body.upvoteRatio,
      replyCount: body.replyCount,
      shareCount: body.shareCount,
      awardCount: body.awardCount,
    },
  });
}
