-- 0065: thêm community_briefs.scraped_meta JSONB.
--
-- Bối cảnh: ext scrape relationship (viewer ↔ habitat) qua selector cascade
-- giống habitat fields. Schema declare trong lib/brief-field-schema.ts;
-- value flat JSONB tránh phải migration mỗi khi thêm field mới.
--
-- Initial fields (Reddit subreddit):
--   - join_status: 'joined' | 'not_joined' | 'unknown'  (đã đồng bộ với
--     column join_status cũ, nhưng scraped_meta là nguồn raw từ ext)
--   - karma_in_sub: integer
--   - member_role: 'mod' | 'contributor' | 'member' | ''
--   - last_visited_at: ISO timestamp
--
-- selector_overrides reuse, dùng field_name có prefix "brief." để phân biệt
-- với habitat fields (page_kind giữ nguyên 'subreddit-about').
-- Idempotent — ADD COLUMN IF NOT EXISTS.

ALTER TABLE community_briefs
  ADD COLUMN IF NOT EXISTS scraped_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Index on scraped_meta cho dashboard query (vd "find tất cả brief mà
-- viewer là mod"). GIN cho lookups arbitrary key.
CREATE INDEX IF NOT EXISTS community_briefs_scraped_meta_idx
  ON community_briefs USING GIN (scraped_meta);
