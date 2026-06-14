-- 0093: append-only per-fetch insights time-series. cards.insights_* keep only the latest snapshot
-- (stale>24h cron overwrites), so view-curve / velocity was unrecoverable. Each insights write appends
-- one row here (server-throttled ~15min). Flat cols stay the "latest" cache → existing readers unchanged.
CREATE TABLE IF NOT EXISTS card_insights_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    TEXT NOT NULL DEFAULT 'self',
  card_id      BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  views_count  INTEGER,
  score        INTEGER,
  upvote_ratio NUMERIC(4,3),
  reply_count  INTEGER,
  share_count  INTEGER,
  award_count  INTEGER
);
CREATE INDEX IF NOT EXISTS card_insights_snap_card_idx ON card_insights_snapshots (card_id, fetched_at);
