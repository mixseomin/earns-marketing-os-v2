-- 0067: Bilingual title cho cards.
-- Trước: `cards.title` 1 cột → khi target_lang != vi, AI trả titleTarget
--        nhưng VN review không có title riêng, operator phải đoán.
-- Sau:   `cards.title` giữ làm titleTarget (đăng thật), thêm `title_review`
--        là bản tiếng Việt để operator review nhanh.
-- Logic tương tự body_review / body_target pattern đã có.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS title_review text NOT NULL DEFAULT '';

-- Backfill: card chưa có title_review → copy từ title (giả định
-- là tiếng Việt vì chưa bilingual mode trước đó).
UPDATE cards SET title_review = title WHERE title_review = '' AND title != '';
