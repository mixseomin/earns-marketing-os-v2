-- Seed session_check_url cho các platform đang có account sống trong browser profile.
-- Tiêu chí chọn URL: trang BẮT BUỘC đăng nhập mới xem được (account / dashboard / my-*). Không dùng
-- trang chủ, trang đăng ký hay trang profile công khai — cả ba đều xem được khi đã đăng xuất, nên
-- không phân biệt được còn phiên hay không.
UPDATE platforms SET session_check_url = v.url
FROM (VALUES
  ('google',        'https://myaccount.google.com/'),
  ('udimi',         'https://udimi.com/my'),
  ('udemy',         'https://www.udemy.com/home/my-courses/learning/'),
  ('getresponse',   'https://app.getresponse.com/dashboard'),
  ('gumroad',       'https://app.gumroad.com/dashboard'),
  ('reddit',        'https://www.reddit.com/settings/account'),
  ('saashub',       'https://www.saashub.com/account'),
  ('alternativeto', 'https://alternativeto.net/manage/'),
  ('crunchbase',    'https://www.crunchbase.com/settings/account'),
  ('cointiply',     'https://cointiply.com/account'),
  ('f6s',           'https://www.f6s.com/account/settings'),
  ('uneed',         'https://www.uneed.best/dashboard'),
  ('webcatalog',    'https://webcatalog.io/account/')
) AS v(key, url)
WHERE platforms.key = v.key;
