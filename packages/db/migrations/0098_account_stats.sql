-- Account-level profile stats scraped from platform (karma, account age/created,
-- followers…). Generic jsonb keyed by stat name — khác post-insights (per-card) +
-- habitat-about (per-community). HN: {karma, created}. X: {followers, following}.
-- Reddit: {post_karma, comment_karma, created}. Latest snapshot; +fetched_at.
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS account_stats jsonb NOT NULL DEFAULT '{}'::jsonb;
