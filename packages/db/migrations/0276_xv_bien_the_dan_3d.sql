-- SỔ TRANG PHỤC (look book): dấu 3D của một biến thể nhân vật (vết bẩn / vết thương dán lên ma-nơ-canh — bo-set-3d.ts › Dan3d, dung-set.py › vet_).
-- Một định nghĩa → mọi shot cùng hình dạng, màu, cỡ, vị trí. 17/10/2026.
ALTER TABLE xv_bien_the ADD COLUMN IF NOT EXISTS dan_3d jsonb;
