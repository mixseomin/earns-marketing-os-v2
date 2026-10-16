-- Mô tả tiếng Việt của hành động shot (góp ý #1397): hanh_dong là câu gửi model (thường tiếng Anh ở phim QC / template), người duyệt cần đọc
-- bằng tiếng Việt trên lưới + thẻ shot. Trống mà hanh_dong đã là tiếng Việt thì giao diện hiện hanh_dong (kieu.ts › moTaVi).
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS hanh_dong_vi text NOT NULL DEFAULT '';
