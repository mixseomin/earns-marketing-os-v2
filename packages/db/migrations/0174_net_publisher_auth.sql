-- Publisher có DANH TÍNH RIÊNG, không mượn user MOS2 nữa.
--
-- Vì sao phải tách: cookie `mos2-session` đặt domain `.on.tc` để SSO giữa các subdomain nội bộ.
-- Gắn publisher vào bảng `users` nghĩa là họ đăng nhập ở pub.on.tc rồi cầm luôn phiên hợp lệ trên
-- mos2.on.tc — middleware chỉ khoá theo host ở pub.on.tc, còn mos2.on.tc thì mở toang. Publisher
-- ngoài chỉ cần gõ đúng tên miền là thấy toàn bộ dashboard nội bộ. Khoá theo host không cứu được
-- chuyện này; phải là hai hệ danh tính khác nhau, hai cookie khác nhau.
--
-- Cookie của publisher (`pub-session`) KHÔNG đặt domain → host-only, trình duyệt không bao giờ gửi
-- nó sang mos2.on.tc, và ngược lại `mos2-session` không mở được /pub.

ALTER TABLE net_publishers
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS password_hash    text,
  ADD COLUMN IF NOT EXISTS password_set_at  timestamptz,
  -- Đặt mật khẩu LẦN ĐẦU bằng link một lần: admin gửi link, publisher tự gõ mật khẩu. Admin không
  -- bao giờ biết mật khẩu của họ, và không có bước nào cần ai đọc hộ ai.
  ADD COLUMN IF NOT EXISTS setup_token      text,
  ADD COLUMN IF NOT EXISTS setup_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS net_publishers_email
  ON net_publishers (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS net_publishers_setup_token
  ON net_publishers (setup_token) WHERE setup_token IS NOT NULL;

-- Cắt hẳn đường cũ. Còn cột này là còn người nối lại, và lỗ mở lại y nguyên.
ALTER TABLE net_publishers DROP COLUMN IF EXISTS user_id;

CREATE TABLE IF NOT EXISTS net_sessions (
  token        text PRIMARY KEY,
  publisher_id bigint NOT NULL REFERENCES net_publishers (id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  ip           inet,
  user_agent   text
);
CREATE INDEX IF NOT EXISTS net_sessions_pub ON net_sessions (publisher_id);
