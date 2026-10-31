-- Phân rã kịch bản bổ sung chi tiết còn thiếu (giày, phụ kiện…) vào mô tả look đã có → ảnh mẫu cũ không còn đúng mô tả: cờ này báo "cần sinh lại",
-- giữ nguyên ảnh cũ tới khi ảnh mới về (hoan-tat.ts tắt cờ khi ghi ảnh).
ALTER TABLE xv_bien_the ADD COLUMN IF NOT EXISTS anh_can_lai boolean NOT NULL DEFAULT false;
