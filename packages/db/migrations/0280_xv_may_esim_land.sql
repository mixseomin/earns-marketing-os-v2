-- Máy thứ ba (roadmap S02 17/10/2026): ngách eSIM DU LỊCH → esimfares.com, mẫu "Before you land" (0đ, máy dựng), góc spy #19191 "Phí roaming đắt đỏ"
-- (94 nhắc) + #19200 "Không kích hoạt được eSIM khi đã ở nước ngoài". Nguồn đề: apps/xuong-video/mau/may/before-you-land.json (30 nước — kho esimfares
-- + sân bay đối chiếu OurAirports, scripts/nguon/before-you-land.py). Nơi đăng để trống tới khi lập bộ kênh; chưa bật.
INSERT INTO xv_may (ma, ten, du_an, muc_dich, mau, nguon, luat, dang, chay) VALUES (
  'esimfares-before-you-land', 'Before you land · eSIM theo nước', 'adfond', 'eSIM du lịch · esimfares.com', 'before-you-land',
  '{"mo_ta": "30 nước du lịch phổ biến: tên nước + cửa ngõ quốc tế chính (OurAirports) + 3 bước eSIM; không giá / nhà mạng (góc spy #19191, #19200)", "dung": 0, "tong": 30}'::jsonb,
  '["Mỗi ngày một nước", "Không nói giá, dung lượng, tốc độ, nhà mạng", "Link đích = trang nước esimfares.com/<iso>/ (gắn UTM theo nền)"]'::jsonb,
  '[]'::jsonb, false
) ON CONFLICT (ma) DO NOTHING;
