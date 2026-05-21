-- Bilingual post drafts: 1 bản tiếng Việt (review/duyệt) + 1 bản ngôn ngữ
-- target (đăng thật, theo habitat.language).
-- body_review: luôn vi-VN, dùng cho operator (Hoàng Tuấn) đọc + duyệt nhanh.
-- body_target: theo target_lang, đây là bản sẽ paste lên community thật.
-- target_lang: en|fr|vi|zh|ko|ja|... auto theo habitat.language; khi='vi' thì
-- 2 trường merge thành 1 (Lyso/Tu Vi Ly So không cần 2 bản).
-- Legacy 'body' giữ lại để backward-compat; auto-migrate sang body_target.
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS body_review text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body_target text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_lang text NOT NULL DEFAULT 'en';

-- Auto-migrate existing body content → body_target
UPDATE cards SET body_target = COALESCE(body, '') WHERE body_target = '' AND body IS NOT NULL AND body <> '';
