-- CHỐNG CAMP TỰ GIÀNH CÙNG TỆP (anh 25/10/2026: duyệt A dọn đoạn quá tải · B cổng bão hoà phim "rule hoá" · D cảnh báo trên Telegram + etp + extension).
-- apps/etp/canh-bao.py tính lại mỗi lượt đồng bộ (10 phút) — MỘT nguồn cho luật NB (chặn nhân bản), Telegram, trang etp, extension app.ethopex.dev.
CREATE TABLE IF NOT EXISTS etp.phim_bao_hoa (
  content_id  integer PRIMARY KEY,
  ten         text,
  so_camp     integer NOT NULL,              -- camp đang chạy của phim (mọi bộ)
  roi         jsonb NOT NULL,                -- [{d, chi, thu, roi}] 3 ngày trọn gần nhất
  chan_nb     text,                          -- lý do chặn nhân bản (B), null = được nhân
  bao_hoa     text,                          -- lý do cảnh báo bão hoà (D), null = không
  luc         timestamptz NOT NULL DEFAULT now()
);
