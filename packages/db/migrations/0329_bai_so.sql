-- SỐ ĐO TỪNG BÀI ĐĂNG (25/10/2026): lượt xem + lượt bấm của mọi bài trên mọi Page (Reel, album ảnh, bài link), đọc Graph API post insights
-- (post_media_view = "Views" của Meta, post_clicks). Khoá = link bài như sổ đăng ghi. Ghi đè số mới nhất, không xoá.
CREATE TABLE IF NOT EXISTS bai_so (
  url text PRIMARY KEY,
  nen text NOT NULL,
  page_id text,
  xem integer,
  bam integer,
  dang_luc timestamptz,
  cap_nhat timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bai_so_cap_nhat ON bai_so (nen, cap_nhat);
