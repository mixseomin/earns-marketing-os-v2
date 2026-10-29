-- KÊNH ig_carousel cho Front Porch (followup #1467, 29/10/2026): cùng IG @frontporchpuzzles (#508) với Reels, chạy trên MacBook qua máy đăng chung
-- dang-may.mjs (dangInstagram nhận mảng ảnh). nhip-an-toan giữ: không cùng chuyện lên Reel + carousel cùng ngày, cách ≥ 3 giờ, trần theo tuổi kênh.
UPDATE xv_may SET dang = dang || jsonb_build_array(jsonb_build_object(
  'nen', 'ig_carousel', 'ten', 'Instagram carousel', 'tk', '@frontporchpuzzles', 'may', 'MacBook', 'gio', '12:05', 'tran', 1,
  'kem', 'carousel 2–4 ảnh câu đố, link in bio',
  'br', jsonb_build_object('acct', '508', 'handle', '@frontporchpuzzles', 'profile', '/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-militarycalc')))
WHERE ma = 'front-porch-only-one' AND NOT dang @> '[{"nen":"ig_carousel"}]';
