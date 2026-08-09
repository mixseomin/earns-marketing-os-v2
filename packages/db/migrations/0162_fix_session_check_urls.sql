-- Sửa 3 session_check_url đoán sai ở 0161 — đã mở từng site bằng profile thật để lấy đường dẫn
-- trong menu người dùng, không đoán tiếp:
--   saashub   /account   → 404 (ảnh: /tmp/session-unsure-saashub-147.png); đúng là /profile
--   cointiply /account   → không tồn tại; menu thật dùng /profile (+ ?intent=…)
--   uneed     /dashboard → 404; /settings mới là trang cần đăng nhập (logout thì đá về trang chủ)
UPDATE platforms SET session_check_url = v.url
FROM (VALUES
  ('saashub',   'https://www.saashub.com/profile'),
  ('cointiply', 'https://cointiply.com/profile'),
  ('uneed',     'https://www.uneed.best/settings')
) AS v(key, url)
WHERE platforms.key = v.key;
