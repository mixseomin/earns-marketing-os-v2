-- Poster của phim: bản đang dùng + mọi bản đã sinh (chọn lại được, không xoá) — xem lib/xuong-video/poster.ts.
ALTER TABLE xv_phim ADD COLUMN IF NOT EXISTS poster_url text;
ALTER TABLE xv_phim ADD COLUMN IF NOT EXISTS poster_uv jsonb NOT NULL DEFAULT '[]'::jsonb;
