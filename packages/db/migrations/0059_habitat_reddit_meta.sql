-- 0059: thêm fields metadata mới scrape được từ Reddit sidebar.
--
-- Bối cảnh: MOS2 Crew extension scrape "About Community" panel khi
-- user mở subreddit. Ngoài subscribers (đã có ở `members`), Reddit
-- mới còn show: created date, privacy type, weekly visitors, weekly
-- contributions. 4 metric này quan trọng cho seeding decision:
--
--   - created_at_source: community age — sub mới (<6 tháng) khó leverage
--     vì chưa có audience loyal; sub cũ (>5 năm) thường có strict rules.
--   - privacy: public | restricted | private. Restricted = approved
--     posters only, cần verify trước khi seed. Private = không seed
--     được.
--   - weekly_visitors: nguồn traffic real (vs subscribers cố định).
--     Sub 200k subscribers nhưng 500 weekly visitors = dormant.
--   - weekly_contributions: posts + comments/tuần. Density signal cho
--     "competition" của bài seed (nhiều = noisy, ít = exposure cao).
--
-- Idempotent: IF NOT EXISTS. Tất cả nullable / default empty cho
-- backward compat (existing habitats không có data này).

ALTER TABLE habitats
  ADD COLUMN IF NOT EXISTS created_at_source timestamp with time zone,
  ADD COLUMN IF NOT EXISTS privacy text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS weekly_visitors integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_contributions integer NOT NULL DEFAULT 0;

-- privacy enum check (không phải pg enum để dễ extend)
ALTER TABLE habitats
  DROP CONSTRAINT IF EXISTS habitats_privacy_chk;
ALTER TABLE habitats
  ADD CONSTRAINT habitats_privacy_chk
  CHECK (privacy IN ('', 'public', 'restricted', 'private'));
