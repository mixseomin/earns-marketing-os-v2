-- 0063: thêm habitats.description column
--
-- Bối cảnh: ext MOS2 Crew scrape Reddit subreddit panel "About community"
-- có 2 fields metadata cuối cùng chưa lưu được vào DB:
--   - description: paragraph mô tả community (vd 'A subreddit for sharing
--     natal, transit, current charts').
--   - icon_url: đã có column từ trước.
--
-- Description khác semantic với 'activity' (activity = "high · 120 posts/d"
-- free-form metric) → cần column riêng. Idempotent ADD COLUMN IF NOT EXISTS.

ALTER TABLE habitats
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
