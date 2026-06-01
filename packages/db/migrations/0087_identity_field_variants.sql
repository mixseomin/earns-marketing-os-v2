-- Identity = pool giá trị: mỗi field có primary (cột sẵn) + BACKUPS để switch khi
-- platform từ chối (username taken/sai format) hoặc khác ràng buộc (password ≥15).
-- field_variants: { fieldKey: [backup1, backup2,...] } cho field KHÔNG nhạy cảm
--   (username/email/display_name/bio/dob/pronouns/custom...). Primary vẫn ở cột cũ.
-- password_variants_enc: JSON array password backup, MÃ HOÁ (pgcrypto) như password_enc.
ALTER TABLE identities ADD COLUMN IF NOT EXISTS field_variants jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE identities ADD COLUMN IF NOT EXISTS password_variants_enc text;
