-- Post-registration follow-up (2-tier: account/platform + join/habitat).
-- Tier 1 (account): steps = platforms.checklist phase='creating' + progress = warmup_checklist.
--   follow_up_at = ngày hẹn check lại khi chờ verify/duyệt (pill ⏳ trên account).
-- Tier 2 (join): joinStatus/joinNote/joinUrl đã có (mig 0057). Thêm:
--   habitats.join_checklist = template bước vào nhóm (per-habitat).
--   community_briefs.join_checklist = progress per (account×habitat).
--   community_briefs.follow_up_at = ngày hẹn check duyệt join.
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;
ALTER TABLE community_briefs   ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;
ALTER TABLE habitats           ADD COLUMN IF NOT EXISTS join_checklist jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE community_briefs   ADD COLUMN IF NOT EXISTS join_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
