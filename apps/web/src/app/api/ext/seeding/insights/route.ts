import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { normalizeParentUrl } from '@/lib/parent-url';

// POST /api/ext/seeding/insights
// Body: {
//   cardId: number,
//   views?: number,
//   score?: number,             // ups - downs (net) hoặc straight ups
//   upvoteRatio?: number,       // 0.0-1.0
//   replyCount?: number,
//   shareCount?: number,
//   awardCount?: number,
//   rawJson?: object,           // raw payload từ Reddit insights API (debug)
// }
//
// Ext fetch Reddit commentstats/<id> qua user session (cookie auth) →
// parse JSON → POST endpoint này. Reddit chưa public API insights nên
// ext side fetch + parse. Lưu raw_json để debug + có thể compute thêm
// metric sau mà không phải re-fetch.

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    cardId?: number;
    // Forum: ext không biết cardId → resolve theo (parentUrl thread + accountHandle).
    parentUrl?: string;
    accountHandle?: string;
    views?: number;
    score?: number;
    upvoteRatio?: number;
    replyCount?: number;
    shareCount?: number;
    awardCount?: number;
    topCountries?: Array<{ country: string; pct: number }>;
    // Reply detail (chi tiết): author/ago/body/score + (forum) permalink/postNum/repliedToYou.
    topReplies?: Array<{ author: string; ago?: string; body: string; score?: number | null; permalink?: string; postNum?: string; repliedToYou?: boolean }>;
    rawJson?: unknown;
  };

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // Resolve cardId: trực tiếp hoặc (parentUrl + accountHandle) cho forum reply-tracking.
  let cardId = Number(body.cardId ?? 0);
  if (!cardId && body.parentUrl) {
    const np = normalizeParentUrl(body.parentUrl);
    const handle = (body.accountHandle ?? '').replace(/^[@u]\/?/, '').trim().toLowerCase();
    const rows = await db.execute(sql`
      SELECT c.id FROM cards c
        JOIN community_briefs b ON b.id = c.brief_id
        LEFT JOIN platform_accounts pa ON pa.id = b.account_id
       WHERE c.thread_key = ${np}
         AND c.post_url IS NOT NULL
         AND c.archived_at IS NULL
         ${handle ? sql`AND lower(pa.handle) = ${handle}` : sql``}
       ORDER BY c.posted_at DESC NULLS LAST, c.created_at DESC
       LIMIT 1`);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (r) cardId = Number(r.id);
  }
  if (!cardId) {
    return NextResponse.json({ ok: false, error: 'cardId (hoặc parentUrl+accountHandle khớp 1 card đã đăng) required', reason: 'card_not_found' }, { status: body.parentUrl ? 200 : 400 });
  }

  // Verify card exists + đã post (insights chỉ make sense cho card đã đăng)
  const checkRows = await db.execute(sql`
    SELECT id, post_url FROM cards WHERE id = ${cardId} LIMIT 1
  `);
  const card = (checkRows as unknown as Array<Record<string, unknown>>)[0];
  if (!card) return NextResponse.json({ ok: false, error: 'Card not found' }, { status: 404 });
  if (!card.post_url) {
    return NextResponse.json({ ok: false, error: 'Card chưa post — không có insights' }, { status: 400 });
  }

  // Build SET clause động — chỉ update field user gửi (cho phép partial sync,
  // vd Reddit ẩn views thì chỉ update upvote_ratio + reply_count).
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
  if (Array.isArray(body.topCountries)) {
    sets.push(sql`insights_top_countries = ${JSON.stringify(body.topCountries.slice(0, 10))}::jsonb`);
  }
  if (Array.isArray(body.topReplies)) {
    // Cap 15 (chi tiết nhất). Sanitize: cắt body, giữ field detail.
    const cleaned = body.topReplies.slice(0, 15).map((r) => ({
      author: String(r.author ?? '').slice(0, 80),
      ago: r.ago ? String(r.ago).slice(0, 40) : undefined,
      body: String(r.body ?? '').slice(0, 600),
      score: r.score != null ? Number(r.score) : undefined,
      permalink: r.permalink ? String(r.permalink).slice(0, 400) : undefined,
      postNum: r.postNum ? String(r.postNum).slice(0, 12) : undefined,
      repliedToYou: r.repliedToYou === true ? true : undefined,
    }));
    sets.push(sql`insights_top_replies = ${JSON.stringify(cleaned)}::jsonb`);
  }
  if (body.rawJson) sets.push(sql`insights_raw_json = ${JSON.stringify(body.rawJson)}::jsonb`);
  sets.push(sql`insights_fetched_at = NOW()`);
  sets.push(sql`updated_at = NOW()`);

  if (sets.length === 2) {  // chỉ có fetched_at + updated_at = không có data sync
    return NextResponse.json({ ok: false, error: 'Không có data insights nào để save' }, { status: 400 });
  }

  // Build UPDATE: sets join bằng ", "
  const setClause = sql.join(sets, sql`, `);
  await db.execute(sql`UPDATE cards SET ${setClause} WHERE id = ${cardId}`);

  return NextResponse.json({
    ok: true,
    cardId,
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
