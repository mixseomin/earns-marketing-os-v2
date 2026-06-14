-- 0094: intended publish time, distinct from the kanban `due` deadline. A future post-queue cron picks
-- dispatch_ready cards WHERE scheduled_at <= now() AND posted_at IS NULL. NULL = post-now / manual.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
