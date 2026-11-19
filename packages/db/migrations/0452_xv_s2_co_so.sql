-- Studio 2: CƠ SỞ PHÂN TÍCH TỪ ASTROLAS theo từng tập (anh 20/11/2026 — nhóm làm video chiêm tinh theo góc nhìn cá nhân, lấy astrolas.com làm cơ sở
-- phân tích; KHÔNG dùng hệ thống Kênh nội dung của Astrolas). Mỗi tập một bản: câu hỏi, người (ngày giờ nơi sinh), bản phân tích site trả, lá số site dùng.
-- Bảng xv_s2_dat của migration 0451 (đặt làm video kênh) không còn mã nào dùng — để nguyên, không xoá dữ liệu.
CREATE TABLE IF NOT EXISTS xv_s2_co_so (
  tap_id     int PRIMARY KEY,
  user_id    int,
  cau_hoi    text NOT NULL DEFAULT '',
  nguoi      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ ten, ngay (YYYY-MM-DD), gio (HH:MM), noi }]
  phan_tich  text NOT NULL DEFAULT '',             -- bản phân tích astrolas.com trả (cầu nối /api/v1/qa/answer)
  nguon      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ title, url }]
  la_so      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- lá số site đã dựng: [{ ten, mat_troi, mat_trang, moc, dung_duoc }]
  usd        numeric(10,5) NOT NULL DEFAULT 0,     -- tiền mô hình phía site, cộng dồn các lượt hỏi của tập
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
