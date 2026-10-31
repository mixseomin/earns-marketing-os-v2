-- LƯỢT XEM THẬT của video đã đăng (anh duyệt 31/10/2026: video thắng của chính kênh = hook đã chứng minh cho dạng game, cạnh QC spy).
-- may-dung.mts --sinh-game đọc lại số YouTube trước mỗi lượt sinh (theo sự kiện, không dựng vòng chạy theo giờ).
ALTER TABLE xv_may_video ADD COLUMN IF NOT EXISTS luot_xem int, ADD COLUMN IF NOT EXISTS luot_xem_luc timestamptz;
