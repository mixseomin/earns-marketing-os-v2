-- Hai forum trong profile CF Capture chưa từng được kiểm phiên vì thiếu session_check_url.
-- Khảo sát trang thật 2026-08-09 (profile .capture-profile):
--   cointalk.com/account            → "You must be logged in to do that." khi chưa login (XenForo)
--   forums.collectors.com/profile   → đá về /entry/signin?Target=profile khi chưa login (Vanilla)
-- Cả hai đều là trang bắt buộc đăng nhập → dùng được làm mốc xác minh.
UPDATE platforms SET session_check_url = v.url
FROM (VALUES
  ('cointalk-com',          'https://www.cointalk.com/account'),
  ('forums-collectors-com', 'https://forums.collectors.com/profile')
) AS v(key, url)
WHERE platforms.key = v.key;
