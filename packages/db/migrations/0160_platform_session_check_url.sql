-- URL để KIỂM TRA phiên đăng nhập của platform: một trang chỉ xem được khi đã login (account /
-- dashboard / my-courses…). Tách khỏi post_url (nơi đăng bài) và signup_url (trang đăng ký) vì hai
-- cái đó phục vụ việc khác — đè lên chúng thì backlink flow đọc ra URL sai.
--
-- Dùng bởi ~/bin/browsers-refresh: ghé URL này rồi tìm dấu hiệu đã-đăng-nhập. Trang đăng ký/landing
-- không dùng được cho việc đó: chúng hiện CTA "Sign in" cho cả người đã login → chấm nhầm là rụng phiên.
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS session_check_url text;

COMMENT ON COLUMN platforms.session_check_url IS
  'Trang chỉ truy cập được khi đã đăng nhập — dùng để xác minh phiên (browsers-refresh).';
