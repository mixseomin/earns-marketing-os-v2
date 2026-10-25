-- MỘT SỔ cho các khái niệm của lịch giờ + thang nhân bản (audit 25/10/2026: cùng một luật đang khai 3–4 nơi — Python lich-gio.py, SQL etp-doc.ts, TS etp-view.tsx; bộ / bậc thang ở cả luat-ethopex.py lẫn nhan-ban.py).
-- 1. Khung giờ VN: etp.khung_gio (mốc + tên) + hàm etp.khung_vn(giờ VN) — máy lịch, trang etp, số theo khung đều gọi hàm này.
CREATE TABLE IF NOT EXISTS etp.khung_gio (
  khung    text PRIMARY KEY,
  gio_tu   smallint NOT NULL,   -- giờ VN bắt đầu (gồm)
  so_gio   smallint NOT NULL,   -- số giờ của khung (khung qua nửa đêm vẫn liền một khối)
  ten      text NOT NULL,       -- nhãn ngắn trên bảng
  ghi      text
);
INSERT INTO etp.khung_gio (khung, gio_tu, so_gio, ten, ghi) VALUES
  ('k07', 7, 1, '07h', 'ngân sách ngày vừa nạp lại (00:00 UTC), Meta xả tiền'),
  ('k08', 8, 5, '08h–12h', null),
  ('k13', 13, 7, '13h–19h', null),
  ('k20', 20, 11, '20h–06h', null)
ON CONFLICT (khung) DO NOTHING;
CREATE OR REPLACE FUNCTION etp.khung_vn(gio integer) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT khung FROM etp.khung_gio WHERE ((gio - gio_tu) % 24 + 24) % 24 < so_gio LIMIT 1
$$;
-- 2. "Camp đang chạy" = đang bật HOẶC đang tạm dừng vì lịch giờ (máy tự bật lại) — đếm bão hoà phim, trần 30 camp / phim, … dùng view này
CREATE OR REPLACE VIEW etp.camp_dang_chay AS
  SELECT c.* FROM etp.camp c WHERE c.trang_thai = 'ACTIVE' OR EXISTS (SELECT 1 FROM etp.lich_tat l WHERE l.camp_id = c.camp_id);
-- 3. Thang nhân bản (anh 25/10/2026: chỉ bộ 2): bộ áp dụng + các bậc ngân sách — luat-ethopex.py (chọn bậc) và nhan-ban.py (chặn) cùng đọc
INSERT INTO etp.cau_hinh (khoa, gia_tri, ghi, ai) VALUES
  ('thang_bo', '["2"]', 'bộ tài khoản đi THANG NHÂN BẢN (không tăng ngân sách camp đang chạy, mở bản mới ở bậc kế) — bộ khác giữ tăng bậc như cũ', 'anh 25/10/2026'),
  ('thang_muc', '[1, 3, 7, 15, 30]', 'các bậc ngân sách của thang nhân bản ($/ngày)', 'anh 25/10/2026')
ON CONFLICT (khoa) DO NOTHING;
