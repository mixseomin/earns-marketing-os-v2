-- 0068: Interaction posts (comment/reply) cần biết URL thread/post gốc
-- để AI có context discussion + operator biết click đâu để paste reply.
--
-- Khi content_type IN ('comment', 'reply') → parent_url BẮT BUỘC (UI valid).
-- Standalone post (text/image/...) → parent_url để NULL.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS parent_url text;

COMMENT ON COLUMN cards.parent_url IS
  'URL của thread/post gốc khi content_type là comment/reply. NULL cho standalone posts.';
