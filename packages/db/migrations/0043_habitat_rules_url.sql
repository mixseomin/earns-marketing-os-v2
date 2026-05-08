-- 0043_habitat_rules_url.sql
-- Optional URL pointing to the canonical rules page (subreddit wiki, FB
-- group "About", forum announcements). Lets admin click-through to verify
-- before posting.

ALTER TABLE habitats
  ADD COLUMN IF NOT EXISTS posting_rules_url text NOT NULL DEFAULT '';
