-- ẢNH QC (ảnh creative tĩnh cho Meta/Google) của một phim quảng cáo — xem apps/xuong-video/src/lib/xuong-video/anh-qc.ts.
-- Mỗi dòng = một ảnh: ảnh mẫu đang thắng (khuôn bố cục) + chữ in trên ảnh + tỉ lệ + model; mọi bản đã sinh ở uv, bản đang dùng ở url.
CREATE TABLE IF NOT EXISTS xv_anh_qc (
  id serial PRIMARY KEY,
  phim_id integer NOT NULL REFERENCES xv_phim(id) ON DELETE CASCADE,
  khuon text NOT NULL DEFAULT '',
  ten text NOT NULL DEFAULT '',
  mau_url text NOT NULL DEFAULT '',
  chu text NOT NULL DEFAULT '',
  y_tuong text NOT NULL DEFAULT '',
  ti_le text NOT NULL DEFAULT '4:5',
  mo_hinh text NOT NULL DEFAULT 'gemini-3-pro-image',
  url text,
  uv jsonb NOT NULL DEFAULT '[]'::jsonb,
  an boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_anh_qc_phim_idx ON xv_anh_qc (phim_id);
