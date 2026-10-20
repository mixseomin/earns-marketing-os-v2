-- Sổ cảnh báo nền tảng: đánh dấu ĐÃ XỬ (anh 21/10/2026 xác minh xong Page Hotel Scam Alerts) — không xoá dòng (luật cấm xoá dữ liệu), chỉ ghi lúc xử + ai + ghi chú.
-- Máy đăng (nhip-an-toan qua canh-bao list) và mos2 Social chỉ tính cảnh báo chưa xử.
ALTER TABLE platform_alerts ADD COLUMN IF NOT EXISTS xong_luc timestamptz, ADD COLUMN IF NOT EXISTS xong_ghi text;
