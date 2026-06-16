import { sql } from 'drizzle-orm';

// SET fragments cho các cột insight SCALAR (views/score/upvoteRatio/reply/share/award) từ 1 source
// lỏng. Mapping y hệt nhau ở /seeding/insights, bulk-insights, insights-by-thing-id (DRY). Chỉ field
// != null mới thêm → caller có thể bỏ field (vd bulk ko gửi shareCount). jsonb (topCountries/replies/
// rawJson) + fetched_at giữ inline ở caller (khác nhau từng route).
export function insightsScalarSets(src: {
  views?: unknown; score?: unknown; upvoteRatio?: unknown;
  replyCount?: unknown; shareCount?: unknown; awardCount?: unknown;
}): ReturnType<typeof sql>[] {
  const sets: ReturnType<typeof sql>[] = [];
  if (src.views != null) sets.push(sql`insights_views_count = ${Math.round(Number(src.views))}`);
  if (src.score != null) sets.push(sql`insights_score = ${Math.round(Number(src.score))}`);
  if (src.upvoteRatio != null) { const r = Math.max(0, Math.min(1, Number(src.upvoteRatio))); sets.push(sql`insights_upvote_ratio = ${r}`); }
  if (src.replyCount != null) sets.push(sql`insights_reply_count = ${Math.round(Number(src.replyCount))}`);
  if (src.shareCount != null) sets.push(sql`insights_share_count = ${Math.round(Number(src.shareCount))}`);
  if (src.awardCount != null) sets.push(sql`insights_award_count = ${Math.round(Number(src.awardCount))}`);
  return sets;
}

// Append ONE row to the per-fetch insights time-series (card_insights_snapshots, migration 0093) from the
// card's CURRENT (post-update) flat insights_* state. Server-throttled ~15min/card via NOT EXISTS so the
// frequent ext scans (already 60s-throttled client-side) don't spam the series. Non-fatal: a snapshot
// failure must never break the insights write — callers ignore the result. Used by /seeding/insights,
// /seeding/bulk-insights, /seeding/insights-by-thing-id (every place that writes insights_* on cards).
type Executor = { execute: (q: ReturnType<typeof sql>) => Promise<unknown> };

export async function appendInsightsSnapshot(db: Executor, cardId: number): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO card_insights_snapshots (card_id, fetched_at, views_count, score, upvote_ratio, reply_count, share_count, award_count)
      SELECT id, NOW(), insights_views_count, insights_score, insights_upvote_ratio, insights_reply_count, insights_share_count, insights_award_count
      FROM cards
      WHERE id = ${cardId}
        AND NOT EXISTS (SELECT 1 FROM card_insights_snapshots s WHERE s.card_id = ${cardId} AND s.fetched_at > NOW() - INTERVAL '15 minutes')`);
  } catch (e) {
    console.warn('[insights-snapshot] append fail:', (e as Error).message);
  }
}
