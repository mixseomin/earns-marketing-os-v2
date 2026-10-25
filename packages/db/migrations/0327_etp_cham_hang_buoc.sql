-- BẢNG CHẤM TRỰC TIẾP (anh 25/10/2026: "thiếu bảng live chi tiết à?"): Worker etp-cham báo từng bước khi đang chấm một creative.
ALTER TABLE etp.cham_hang ADD COLUMN IF NOT EXISTS buoc text;                          -- bước đang làm (lời thường)
ALTER TABLE etp.cham_hang ADD COLUMN IF NOT EXISTS nhat_ky jsonb NOT NULL DEFAULT '[]'; -- [{b: bước, luc: giờ}] theo thứ tự
