-- Account password encrypted at rest (pgcrypto, như identities.password_enc).
-- Ext lưu password account khi tạo → mã hoá; reveal qua GET ?reveal=1.
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS password_enc text;
