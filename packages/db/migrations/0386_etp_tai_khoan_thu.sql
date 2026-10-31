-- TÀI KHOẢN THỬ etp.on.tc (anh 31/10/2026: "tạo 1 tk mới là test rồi tự mà chụp") — chụp kiểm giao diện theo từng vai mà không mượn phiên người thật.
-- Email đuôi .invalid: không có hộp thư, không đăng nhập SSO Google được → chỉ vào bằng phiên tạm auth_sessions (CLAUDE.md "Phiên đo màn", tự hết hạn 15 phút).
-- Vai mặc định = admin etp gắn người #115 (nhìn như Sơn: thấy ✎). Sửa camp thật vẫn cần phiên Ethopex RIÊNG của người đó (sua-ngoai.py ket) — tài khoản thử
-- không có cách nào lấy được phiên đó. Đổi vai để chụp vai khác: update etp.quyen set vai = 'nguoi', nguoi_id = 116 where user_id = (select id from users where email = 'etp-thu@mos2.invalid').
insert into users (email, name, chi_host) values ('etp-thu@mos2.invalid', 'Thử etp (chụp kiểm)', 'etp.on.tc')
  on conflict (tenant_id, email) do nothing;
insert into members (user_id, role, display_name, specialty, active)
  select id, 'viewer', 'Thử etp (chụp kiểm)', 'other', true from users where email = 'etp-thu@mos2.invalid'
    and not exists (select 1 from members m join users u on u.id = m.user_id where u.email = 'etp-thu@mos2.invalid');
insert into etp.quyen (user_id, vai, nguoi_id, ghi)
  select id, 'admin', 115, 'tài khoản thử chụp kiểm (anh 31/10/2026) — không có phiên Ethopex, không sửa được camp thật' from users where email = 'etp-thu@mos2.invalid'
  on conflict (user_id) do nothing;
