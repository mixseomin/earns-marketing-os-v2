-- thread_key: canonical thread id của card (= normalizeParentUrl(parent_url),
-- tính 1 lần lúc write qua updatePost). Read so BẰNG cột này → bỏ regexp SQL
-- (chỗ phân kỳ với JS gây lệch version/track). 1 nguồn sự thật, scale an toàn.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS thread_key text;
CREATE INDEX IF NOT EXISTS idx_cards_thread_key ON cards (thread_key);
-- Backfill thread_key cho card cũ: chạy 1 lần qua POST /api/ext/admin/backfill-thread-key
-- (dùng đúng hàm normalizeParentUrl — KHÔNG replicate logic trong SQL).
