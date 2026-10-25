-- GÓC (nguồn idea) cho mọi bài đăng (anh duyệt 25/10/2026: "các nội dung đăng lên cũng phải sử dụng + show rõ ràng các góc cụ thể"):
-- góc lấy từ kho spy.on.tc (bảng goc của DB spy). Mỗi máy studio khai nhóm góc spy của thương hiệu (xv_may.goc_sp); bài mang dang.goc
-- { sp, id, loai, ten }; bài hẹn giờ mang bai_hen.goc. Bài tạo từ 26/10/2026 thiếu góc → Phòng Nội dung chặn (apps/cty/worker/cham-dang.mjs).
ALTER TABLE xv_may ADD COLUMN IF NOT EXISTS goc_sp integer[];
ALTER TABLE bai_hen ADD COLUMN IF NOT EXISTS goc jsonb;
-- nhóm góc spy theo thương hiệu (id goc_sp bên spy): 1435 large print word search · 1438 dementia activities · 181 eSIM du lịch · 180 Vé máy bay ·
-- 179 Dịch vụ đặt phòng khách sạn · 1552 Giỗ Chạp
UPDATE xv_may SET goc_sp = '{1435,1438}' WHERE ma = 'front-porch-only-one' AND goc_sp IS NULL;
UPDATE xv_may SET goc_sp = '{181,180}' WHERE ma = 'esimfares-before-you-land' AND goc_sp IS NULL;
UPDATE xv_may SET goc_sp = '{179}' WHERE ma = 'ratesbyroom-scam-or-real' AND goc_sp IS NULL;
UPDATE xv_may SET goc_sp = '{1552}' WHERE ma = 'giochap-van-khan' AND goc_sp IS NULL;
