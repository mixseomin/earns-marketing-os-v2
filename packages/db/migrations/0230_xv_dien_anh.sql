-- Tầng truyện → phân cảnh → shot (góp ý #1194 + #1195, 08/10/2026). Mỗi dòng xv_canh giờ là MỘT SHOT (đơn vị sinh ảnh/video);
-- shot cùng phan_doan hợp thành một phân cảnh (scene) mà mục tiêu/xung đột/cảm xúc đầu-cuối nằm ở xv_tap.phan_canh.
-- ky_thuat = kỹ thuật chọn từ thư viện điện ảnh (src/lib/xuong-video/dien-anh.ts): cỡ cảnh, góc, chuyển động, ống kính, ánh sáng, màu,
-- chuyển cảnh, âm thanh, nhạc. cam_xuc = giá trị cảm xúc cuối shot (-5..5) → đường cong cảm xúc trên timeline.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS phan_doan text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cam_xuc smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ky_thuat jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS beats jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS phan_canh jsonb NOT NULL DEFAULT '[]'::jsonb;
