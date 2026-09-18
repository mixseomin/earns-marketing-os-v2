-- PHỦ: số dư nguồn traffic là SỐ, không phải chữ trong ghi_chu. Anh ra 18/09/2026: "TF balance chưa có trong tab
-- Nguồn traffic" — adapter đã đọc balance mỗi 2h nhưng chỉ nhét vào ghi_chu, cột Nạp = tiền đã nạp nên vẫn 0.
ALTER TABLE phu_nguon ADD COLUMN IF NOT EXISTS so_du numeric;
ALTER TABLE phu_nguon ADD COLUMN IF NOT EXISTS so_du_luc timestamptz;
