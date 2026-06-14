import { sql } from 'drizzle-orm';

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
