-- Bước "thử người xem lần đầu" của mỗi tập (nguoi-xem.ts): kết quả lần thử gần nhất + mã phiên bản kịch bản lúc thử.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS thu_nguoi_xem jsonb;
