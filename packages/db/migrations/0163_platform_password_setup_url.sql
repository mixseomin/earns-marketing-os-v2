-- Trang ĐẶT/ĐỔI password của platform. Account đăng nhập bằng Google SSO thì cả phiên treo vào một
-- Gmail duy nhất: Gmail rụng hay bị khoá là mất sạch account con và không còn đường vào lại. Chuẩn
-- hoá: login SSO xong thì đặt luôn password thuần rồi lưu vault (~/bin/browsers-setpass).
--
-- Tách khỏi session_check_url (trang kiểm phiên) vì hai việc khác nhau; site cho đặt password
-- thường có trang riêng (security/password), và nhiều site SSO-only thì cột này để NULL — đó cũng
-- là thông tin: không đặt được password, account đó buộc phụ thuộc Gmail.
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS password_setup_url text;

COMMENT ON COLUMN platforms.password_setup_url IS
  'Trang đặt/đổi password. NULL = site không cho đặt password (SSO-only) hoặc chưa khảo sát.';

UPDATE platforms SET password_setup_url = v.url
FROM (VALUES
  ('reddit',      'https://www.reddit.com/settings/account'),
  ('gumroad',     'https://app.gumroad.com/settings'),
  ('crunchbase',  'https://www.crunchbase.com/settings/account'),
  ('getresponse', 'https://app.getresponse.com/account/settings'),
  ('cointiply',   'https://cointiply.com/profile?intent=settings')
) AS v(key, url)
WHERE platforms.key = v.key;
