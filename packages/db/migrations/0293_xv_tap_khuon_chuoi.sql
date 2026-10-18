-- Khuôn chuỗi shot áp trong tập (apps/xuong-video/src/lib/xuong-video/khuon-chuoi.ts › ApKhuon[]): mỗi phần tử = một lần áp một khuôn,
-- gán từng shot (id xv_canh) vào một bước. Timeline đọc để vẽ làn 🧭 Khuôn + kiểm vai từng shot.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS khuon_chuoi jsonb NOT NULL DEFAULT '[]'::jsonb;
