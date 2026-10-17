-- Giá trị ô RIÊNG của một biến thể diễn viên (tên nhân vật, người phụ, bối cảnh 2, giọng…) — thư viện bối cảnh + diễn viên phân bổ theo bộ hình
-- (thu-vien-dien.ts › phanBo), đè giá trị chung của cặp. 17/10/2026.
ALTER TABLE xv_bien_the_hinh ADD COLUMN IF NOT EXISTS o jsonb NOT NULL DEFAULT '{}'::jsonb;
