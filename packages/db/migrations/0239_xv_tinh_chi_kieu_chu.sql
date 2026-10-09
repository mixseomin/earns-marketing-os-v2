-- (1) xv_job.tinh_chi: job có tính vào TỔNG chi phí của phim hay không (anh 10/10/2026: "reset cost tổng, chỉ đếm những thứ vừa tạo cho
--     shot 1 để làm chuẩn"). Không xoá job nào — lịch sử tiền thật vẫn nguyên, báo cáo chi theo ngày vẫn đếm đủ; chỉ tổng của phim bỏ qua.
-- (2) xv_canh.kieu_chu: kiểu chữ màn RIÊNG của shot, đè lên kieu_chu của phim (QC mẫu mỗi cảnh một kiểu: hook chữ xanh to, cảnh thường
--     chữ trắng nhỏ, băng nền tím…) — {font, mau, vien, nhan, co, vien_day, ngang, y (0–1 tâm dọc), nen (#màu băng nền)}.
ALTER TABLE xv_job ADD COLUMN IF NOT EXISTS tinh_chi boolean NOT NULL DEFAULT true;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS kieu_chu jsonb NOT NULL DEFAULT '{}'::jsonb;
