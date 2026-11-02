-- KÊNH ASTROLAS LÊN mos2 › Tài sản › 📺 Kênh nội dung + PHIM KÊNH TRONG STUDIO (anh 02/11/2026: "phải dựng luôn phần kênh nội dung và Studio
-- để còn follow theo rồi mới bắt đầu plan"). Kế hoạch: apps/xuong-video/docs/astrolas-youtube.md; lộ trình G0–G10: apps/xuong-video/scripts/lich-su/lo-trinh.json.
-- KHÔNG bật gì để làm / đăng: chỉ hiển thị. Mục YouTube @astrolasapp trong xv_may.dang vẫn khoá; máy làm tập (chay-kenh.mjs) chỉ đọc kenh.json, chưa có astrolas.
-- Panel chỉ đếm tập kênh (de.loai 'video-ngoai'), nên 36 video FB Dạng × Góc của máy astrolas không lẫn vào.
UPDATE xv_may SET la_san_pham = true WHERE ma = 'astrolas';

-- Phim Studio của kênh: tap-day.mts tìm phim theo kinh_thanh.may → các tập Astrolas sau này tự vào phim này (không đẻ phim mới).
INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai)
SELECT 'studio', 'Astrolas', 'short',
  'Kênh YouTube Astrolas (@astrolasapp) — video kể chuyện 9:16 trỏ về công cụ thật của astrolas.com. Chưa dựng tập nào: đang ở G0 (chờ anh chốt). Lộ trình ở khối 🧭 bên dưới (scripts/lich-su/lo-trinh.json); kế hoạch đầy đủ: apps/xuong-video/docs/astrolas-youtube.md.',
  '{"kenh": "astrolas", "may": "astrolas", "ti_le": "9:16"}'::jsonb, 'nhap'
WHERE NOT EXISTS (SELECT 1 FROM xv_phim WHERE kinh_thanh->>'may' = 'astrolas');
