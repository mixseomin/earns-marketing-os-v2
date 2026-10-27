-- ẢNH NỀN THÊM cho mẫu nhiều cảnh (Top 3/5 đếm ngược — bước 3 Dạng × Góc × Sản phẩm, 27/10/2026): mỗi mục một ảnh thật riêng (Pexels),
-- máy tự lấy lúc xuất như nen_url rồi ghi lại đây để dựng lại không đổi ảnh; Phòng Nội dung kiểm nguồn ảnh cả danh sách này (cham-dang › nen_them).
ALTER TABLE xv_may_video ADD COLUMN IF NOT EXISTS nen_them text[] NOT NULL DEFAULT '{}';
