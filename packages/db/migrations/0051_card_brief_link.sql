-- Liên kết card về (brief × phase) để mỗi PhaseEntryEditor có thể list +
-- tạo bài viết trực tiếp. brief_id nullable vì card có thể không thuộc
-- brief (legacy + free-form work).
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS brief_id    bigint REFERENCES community_briefs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brief_phase text;

CREATE INDEX IF NOT EXISTS cards_brief_idx ON cards (brief_id, brief_phase);
