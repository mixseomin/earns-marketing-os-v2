-- TRẠNG THÁI "✎ SỬA LẠI" CHO CREATIVE CHỜ DUYỆT (anh 25/11/2026, etp2 #1863 "Thêm 1 status là Sửa lại !!").
-- Thứ ba bên cạnh Duyệt / Loại: creative KHÔNG lên camp (ghi cham_duyet ok = false nên mọi đường lên camp — cham_cong, lenh_cho.py,
-- ▶ Lên — tự chặn như Loại), nhưng đánh dấu sua_lai = true: creative còn hiện ở bảng cây với trạng thái ✎ Sửa lại, nhận xét bắt buộc
-- (etp.nhan_xet_cr, sua_lai = true) là hướng dựng lại. Bấm Duyệt / Loại về sau ghi đè cờ (sua_lai = false).
ALTER TABLE etp.cham_duyet ADD COLUMN IF NOT EXISTS sua_lai boolean NOT NULL DEFAULT false;
ALTER TABLE etp.nhan_xet_cr ADD COLUMN IF NOT EXISTS sua_lai boolean NOT NULL DEFAULT false;
