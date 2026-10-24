-- Nguồn không gian 2D cho phim KHÔNG 3D (xuong-video khong-gian.ts): theo từng cảnh (khoá = phan_doan) — sơ đồ cảnh, người, sổ đồ vật, sổ dáng.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS khong_gian jsonb NOT NULL DEFAULT '{}'::jsonb;
