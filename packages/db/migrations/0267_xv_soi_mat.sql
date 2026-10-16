-- Soi mặt (16/10/2026, chuẩn bị phim người thật): mặt trong keyframe so với ảnh mẫu nhân vật (OpenCV YuNet + SFace trên máy chủ, 0đ).
-- url = keyframe đã soi — keyframe đổi là kết quả hết hiệu lực; cổng video / animatic (khung.ts › chanKhung) chặn khi mặt lệch ảnh mẫu.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS soi_mat jsonb;
