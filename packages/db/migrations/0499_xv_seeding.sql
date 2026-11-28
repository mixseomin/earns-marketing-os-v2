-- Seeding kênh (anh 28/11/2026): kênh nhà vào bình luận dưới video top của kênh nổi tiếng cùng chủ đề để kéo người xem về.
-- xv_seeding_kenh = kênh mục tiêu của một máy · xv_seeding_bl = từng bình luận máy đặt (đo lại: còn hiện, like 24h/72h, trả lời).
CREATE TABLE IF NOT EXISTS xv_seeding_kenh (
  id serial PRIMARY KEY,
  may text NOT NULL,
  kenh_id text NOT NULL,
  ten text NOT NULL,
  handle text,
  nguoi_dk int,
  chu_de text,
  video_top jsonb NOT NULL DEFAULT '[]',
  bat boolean NOT NULL DEFAULT true,
  do_luc timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (may, kenh_id)
);
CREATE TABLE IF NOT EXISTS xv_seeding_bl (
  id serial PRIMARY KEY,
  may text NOT NULL,
  kenh_id text NOT NULL,
  video_id text NOT NULL,
  video_ten text,
  chu text NOT NULL,
  trang_thai text NOT NULL DEFAULT 'nhap',
  bl_id text,
  dang_luc timestamptz,
  con_hien boolean,
  like_24h int, like_72h int, like_nay int,
  tra_loi int,
  do_luc timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (may, video_id)
);
CREATE INDEX IF NOT EXISTS xv_seeding_bl_may ON xv_seeding_bl (may, kenh_id);
