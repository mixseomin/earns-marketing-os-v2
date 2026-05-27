-- 0073 — Reddit/community insights columns cho cards đã đăng.
-- Ext scrape Reddit insights page (commentstats/t1_xxx) bằng user session
-- → POST /api/ext/seeding/insights save vào đây.
--
-- Lưu raw_json để debug + có thể compute thêm metric sau (vd CTR, dwell time
-- nếu Reddit thêm) mà không phải re-fetch.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS insights_views_count   integer,
  ADD COLUMN IF NOT EXISTS insights_score         integer,        -- ups - downs (net)
  ADD COLUMN IF NOT EXISTS insights_upvote_ratio  numeric(4, 3),  -- 0.000-1.000
  ADD COLUMN IF NOT EXISTS insights_reply_count   integer,
  ADD COLUMN IF NOT EXISTS insights_share_count   integer,
  ADD COLUMN IF NOT EXISTS insights_award_count   integer,
  ADD COLUMN IF NOT EXISTS insights_fetched_at    timestamp with time zone,
  ADD COLUMN IF NOT EXISTS insights_raw_json      jsonb;

-- Index để query "cards posted < 30 ngày, insights stale (fetched > 24h ago)"
-- phục vụ cron sync sau này (Phase 3).
CREATE INDEX IF NOT EXISTS cards_insights_stale_idx
  ON cards (posted_at, insights_fetched_at)
  WHERE post_url IS NOT NULL;
