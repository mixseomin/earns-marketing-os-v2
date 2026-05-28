-- 0082: habitat_channels.no_posting boolean — block posting on specific channel.
-- User manual flag (vd Discord #announcements, #rules, #welcome) — không seeding
-- bài vào channel này dù channel có trong habitat.
--
-- Ext sidepanel có toggle ngay khi xem channel page. Seeding planner sẽ
-- skip mọi channel có no_posting=true khi gen lịch / autopost.
--
-- Default false (cho phép post). Reset về false = bỏ block.

ALTER TABLE habitat_channels
  ADD COLUMN IF NOT EXISTS no_posting boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN habitat_channels.no_posting IS
  'Manual flag: true = block posting trên channel này (vd #rules, #announcements). Default false.';
