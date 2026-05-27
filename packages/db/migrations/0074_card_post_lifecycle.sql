-- 0074 — Track lifecycle của comment đã đăng (live/ghosted/removed/etc).
-- Trước nay chỉ có post_url + posted_at + archived_at; thiếu signal cho
-- comment bị Reddit shadow-ban, mod xóa, user tự xoá, hoặc low-engagement.
--
-- Sử dụng: user mark thủ công khi phát hiện, hoặc cron auto-detect (Phase D)
-- gọi Reddit anon API 24h sau posted_at để confirm visibility.
--
-- Values:
--   NULL              = chưa post / chưa kiểm tra
--   'live'            = visible cho anonymous viewer, có engagement bình thường
--   'ghosted'         = Reddit shadow-ban: URL tồn tại nhưng anon trả 404/hidden
--   'removed-by-mod'  = mod xóa, body = [removed]
--   'self-deleted'    = user tự xoá, body = [deleted]
--   'low-engagement'  = live nhưng 0 upvote/reply sau 24-48h

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS post_lifecycle text,
  ADD COLUMN IF NOT EXISTS post_lifecycle_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS post_lifecycle_note text;

-- Index để query engagement attempts theo parent_url cross-brief/account.
-- Phase B (listEngagementsByParentUrl) sẽ filter c.parent_url = X.
CREATE INDEX IF NOT EXISTS cards_parent_url_idx
  ON cards (parent_url)
  WHERE parent_url IS NOT NULL;

-- Index cho cron auto-detect: filter "đã post + chưa kiểm tra lifecycle"
-- AND "posted > 24h ago". WHERE post_url IS NOT NULL = hot path.
CREATE INDEX IF NOT EXISTS cards_lifecycle_check_idx
  ON cards (posted_at, post_lifecycle_at)
  WHERE post_url IS NOT NULL;

-- Habitat-level flag: subreddit nào có cơ chế tự detect AI content (vd
-- r/Astrology_Vedic dùng detector → comment AI hay bị remove/ghost).
-- AI gen strategy phải né patterns rõ ràng (markdown, em dash, '—')
-- và voice phải human hơn khi flag = true.
ALTER TABLE habitats
  ADD COLUMN IF NOT EXISTS ai_content_detection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_detection_note text;
