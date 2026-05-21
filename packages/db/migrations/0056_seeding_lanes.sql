-- 0056: seeding lanes — mỗi brief (account×habitat) có NHIỀU lịch, mỗi
-- lane = (content_type, language) với tần suất + cadence riêng.
-- content_type='mix' = xoay theo formatMix (tương thích row cũ).
-- language='' = kế thừa habitat.language.
-- Idempotent. KHÔNG mất data: row cũ -> lane (mix, '').

ALTER TABLE seeding_schedules
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'mix';

ALTER TABLE seeding_schedules
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT '';

-- chuyển unique 1-per-brief -> unique theo lane
DROP INDEX IF EXISTS seeding_schedules_brief_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS seeding_schedules_brief_lane_uniq
  ON seeding_schedules (brief_id, content_type, language);
