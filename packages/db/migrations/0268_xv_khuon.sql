-- KHUÔN VIDEO (16/10/2026, anh "chuyển hoàn toàn việc sx video của Front Porch Puzzles sang studio"): video dựng bằng KHUÔN, không AI
-- (apps/xuong-video/src/lib/xuong-video/khuon-mot-dung.ts — libass + ffmpeg trên box3, 0đ). Một dòng = một video.
--   de       — đề bài của khuôn (mot-dung: dich, o[36], cho, goi, mau{sau,truoc,nhan}); nguồn đề = puzzle-books/scripts/de-short.mjs (day-studio.mjs đẩy)
--   dang     — chữ để đăng: title, description, link, book, words
--   nen_url  — ảnh nền theo chủ đề (AI, ~$0,004, dùng chung cho mọi video cùng chủ đề) — null = dải màu bìa
--   file_url — bản xuất mới nhất (R2); dang-short.mjs (iMac/MacBook) tải từ đây để đăng
CREATE TABLE IF NOT EXISTS xv_khuon (
  id serial PRIMARY KEY,
  du_an text NOT NULL,
  khuon text NOT NULL,
  slug text NOT NULL UNIQUE,
  chu_de text NOT NULL DEFAULT '',
  de jsonb NOT NULL,
  dang jsonb NOT NULL DEFAULT '{}'::jsonb,
  nen_url text,
  nen_prompt text,
  file_url text,
  giay numeric,
  xuat_luc timestamptz,
  loi text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_khuon_du_an ON xv_khuon (du_an, khuon);
