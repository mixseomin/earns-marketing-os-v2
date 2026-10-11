-- Lớp phủ tự do của tập (chữ, ảnh, hình khối) — như trình dựng video; xem kieu.ts › Lop.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS lop jsonb NOT NULL DEFAULT '[]'::jsonb;
