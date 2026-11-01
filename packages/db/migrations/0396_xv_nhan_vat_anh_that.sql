-- Ảnh thật của anchor (nơi / vật): ảnh gốc vẽ lại từ đây theo phong cách phim (sinh-anh.ts › sinhAnhGoc), không vào anh_ref.
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS anh_that jsonb NOT NULL DEFAULT '[]'::jsonb;
