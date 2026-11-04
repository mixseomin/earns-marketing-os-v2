-- SỔ KÊNH (anh 04/11/2026: "cần có nơi tổ chức để sau này lên video mới ko bị chệch hướng" → "show ở Kênh nội dung"): lo-trinh.json đổi thành
-- apps/xuong-video/scripts/lich-su/so-kenh.json (định vị · luật · 13 mẫu đã duyệt · hàng chờ ý tưởng · playlist · lộ trình). Mô tả phim Astrolas trong Studio
-- (migration 0411) còn ghi "Chưa dựng tập nào / G0 / lo-trinh.json" → cập nhật đúng hiện trạng. Chỉ chữ mô tả, không bật làm / đăng gì.
UPDATE xv_phim SET mo_ta = 'Kênh YouTube Astrolas (@astrolasapp) — Short 9:16 + video dài 16:9 trỏ về công cụ thật của astrolas.com. G2 bộ nhận diện + G3 13 mẫu đã duyệt (04/11/2026), đang G4 dữ liệu thật. Sổ kênh (định vị, luật, mẫu, hàng chờ ý tưởng, lộ trình): mos2 › Tài sản › 📺 Kênh nội dung › Astrolas; tệp scripts/lich-su/so-kenh.json, máy gác scripts/lich-su/kiem-so-kenh.mjs.'
WHERE kinh_thanh->>'may' = 'astrolas' AND mo_ta LIKE '%lo-trinh.json%';
