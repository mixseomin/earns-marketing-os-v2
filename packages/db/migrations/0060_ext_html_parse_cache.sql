-- 0060: cache table cho ext HTML parse qua Claude API.
--
-- Use case: MOS2 Crew ext POST raw HTML sidebar (Reddit/FB/X/etc.) sang
-- /api/ext/habitat-html-parse → server gọi Claude Haiku parse → trả về
-- structured fields. Reddit/etc. thay đổi DOM thường xuyên → text-pattern
-- regex trong content.js miss. Fallback LLM parse, cache theo SHA256 hash
-- HTML để Reddit redesign mới tốn 1 LLM call (~$0.01), redesign cũ free.
--
-- Idempotent. Auto-prune sau 30 ngày qua cron riêng (chưa làm).

CREATE TABLE IF NOT EXISTS ext_html_parse_cache (
  html_hash text PRIMARY KEY,
  platform text NOT NULL,         -- 'reddit' | 'facebook' | ...
  page_kind text NOT NULL,        -- 'subreddit-about' | 'subreddit-rules' | ...
  fields_json jsonb NOT NULL,
  model text NOT NULL,            -- 'claude-haiku-4-5'
  created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ext_html_cache_platform_idx ON ext_html_parse_cache (platform, page_kind);
CREATE INDEX IF NOT EXISTS ext_html_cache_created_idx ON ext_html_parse_cache (created_at);

-- Grant cho user 'mos2' (xem memory feedback_mos2_grant_new_tables — sau
-- CREATE TABLE phải GRANT thủ công, superuser earns không auto-grant).
GRANT SELECT, INSERT, UPDATE, DELETE ON ext_html_parse_cache TO mos2;
