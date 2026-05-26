-- 0069: Parent context cho comment/reply — không chỉ URL mà cả nội dung
-- thread/post gốc để AI generate reply có context.
--
-- 4 fields mới (nullable, chỉ dùng khi content_type IN ('comment','reply')):
--   parent_title:    tiêu đề thread/post gốc (1 dòng)
--   parent_body:     full body (markdown/text)
--   parent_author:   handle author (giúp AI biết tone reply)
--   parent_snippets: top comments / related quotes (jsonb [{author, text}])

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS parent_title    text,
  ADD COLUMN IF NOT EXISTS parent_body     text,
  ADD COLUMN IF NOT EXISTS parent_author   text,
  ADD COLUMN IF NOT EXISTS parent_snippets jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN cards.parent_title    IS 'Title của thread/post gốc khi content_type là comment/reply.';
COMMENT ON COLUMN cards.parent_body     IS 'Body markdown/text của parent — AI prompt nạp khi generate reply.';
COMMENT ON COLUMN cards.parent_author   IS 'Handle author của parent (vd "u/SomeUser" / "@john_doe") để AI biết tone reply.';
COMMENT ON COLUMN cards.parent_snippets IS 'Top comments/quotes liên quan, JSONB [{author, text}].';
