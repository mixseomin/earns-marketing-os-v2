-- KHÁCH MỘT TRANG (anh 29/10/2026: "sso thêm 1 người nữa chỉ vào đc riêng page này … chỉ view"): users.chi_host = host duy nhất
-- người này được dùng phiên mos2 (vd 'etp.on.tc'). getCurrentUser() trả null ở MỌI host khác → mos2.on.tc, spy, studio… đều coi
-- như chưa đăng nhập; đăng nhập SSO xong luôn đưa về đúng host đó. Quyền xem/sửa vẫn theo members.role (viewer = chỉ xem).
alter table users add column if not exists chi_host text;
