-- Kiểm khung (14/10/2026): kết quả máy nhìn keyframe so với thẻ shot + các khung cùng cảnh (bố trí set, trục máy, nhân vật thừa/thiếu, ánh sáng).
-- url = keyframe đã kiểm — keyframe đổi là kết quả hết hiệu lực; cổng video / animatic đọc cột này.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS kiem_khung jsonb;
