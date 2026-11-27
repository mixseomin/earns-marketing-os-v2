-- KÊNH ORBIBALL (anh 28/11/2026 "Chắc phải tạo kênh mới. Mày chọn 1 tên rồi lưu vào Kênh nội dung"): kênh mô phỏng vật lý không lời,
-- máy dựng apps/xuong-video/scripts/vat-ly/lam.mjs (iMac, 0₫). Sổ kênh: apps/xuong-video/scripts/lich-su/so-kenh.json › orbiball.
-- Chưa có kênh YouTube (handle @orbiball còn trống) → dang rỗng, chay=false tới khi anh bảo tạo kênh.
INSERT INTO xv_may (ma, ten, du_an, muc_dich, mau, nguon, luat, dang, chay, site_dich, ngach, la_san_pham) VALUES (
  'orbiball', 'Mô phỏng vật lý · Orbiball', 'mos2',
  'Kênh mô phỏng vật lý không lời (sản phẩm = video mô phỏng trọn trận / trọn vòng): bóng thoát vòng, đua bi, trận bóng hai đội trong sân tròn với đội hình thật. Máy: apps/xuong-video/scripts/vat-ly/lam.mjs (iMac) → video-ngoai.',
  'video-ngoai', '{}'::jsonb,
  '["Tiêu đề luôn có Marble / Physics / Simulation", "Không logo, huy hiệu, ảnh trận thật, mặt cầu thủ", "Đội hình lấy từ Wikipedia (doi-hinh.mjs)"]'::jsonb,
  '[]'::jsonb, false, NULL, '{vat-ly}', true
) ON CONFLICT (ma) DO NOTHING;
