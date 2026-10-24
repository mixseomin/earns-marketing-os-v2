-- etp.on.tc bước 3 (anh 24/10/2026 "tiếp đi"): RÀO CHẮN chung cho mọi lệnh tự động + CẢNH BÁO bất thường.
-- cau_hinh: một khoá một dòng — dung_khan (nút dừng khẩn: chặn tăng / bật / nhân bản / tạo camp; vẫn cho giảm + tắt),
--           tran_ngay (tổng ngân sách ngày mọi camp đang bật, null = không trần — anh: dòng tiền không giới hạn), tran_camp ($/camp), tran_bo ({bộ: $}).
-- Cổng kiểm: apps/etp/cong.py — lam-ethopex.py + nhan-ban.py gọi trước khi gửi lệnh lên Ethopex.
CREATE TABLE IF NOT EXISTS etp.cau_hinh (
  khoa     text PRIMARY KEY,
  gia_tri  jsonb NOT NULL,
  ghi      text,
  ai       text,
  luc      timestamptz NOT NULL DEFAULT now()
);
INSERT INTO etp.cau_hinh (khoa, gia_tri, ghi, ai) VALUES
  ('dung_khan', 'false', 'true = chặn mọi lệnh tăng / bật / nhân bản / tạo camp (giảm + tắt vẫn chạy)', 'claude (dựng 24/10/2026)'),
  ('tran_ngay', 'null', 'tổng ngân sách ngày mọi camp đang bật — null = không trần', 'claude (dựng 24/10/2026)'),
  ('tran_camp', '30', 'ngân sách ngày tối đa một camp ($) — khớp thang hiện hành (T30)', 'claude (dựng 24/10/2026)'),
  ('tran_bo', '{}', '{bộ: $} tổng ngân sách ngày của một bộ tài khoản — trống = không trần', 'claude (dựng 24/10/2026)')
ON CONFLICT (khoa) DO NOTHING;

-- cảnh báo bất thường (apps/etp/canh-bao.py chạy cuối mỗi lượt đồng bộ); phòng Ethopex (cty) gửi Telegram dòng chưa gửi.
CREATE TABLE IF NOT EXISTS etp.canh_bao (
  id        bigserial PRIMARY KEY,
  luc       timestamptz NOT NULL DEFAULT now(),
  loai      text NOT NULL,
  muc       text NOT NULL,          -- do (khẩn) | vang (xem)
  khoa      text NOT NULL UNIQUE,   -- chống báo lặp: loai + đối tượng + ngày
  noi_dung  text NOT NULL,
  da_gui    timestamptz
);
