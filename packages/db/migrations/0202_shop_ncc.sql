-- SHOP — SỔ NHÀ CUNG CẤP (anh yêu cầu 01/10/2026: NCC phải có tên, link, nơi liên hệ — sửa được ở /shop › Nhà cung cấp).
-- khoa = shop_cua_hang.ncc. lien_he: [{kenh: email|whatsapp|skype|telegram|wechat|chat|phone|khac, gia_tri, ten}]. links: [{nhan, url}].
CREATE TABLE IF NOT EXISTS shop_ncc (
  khoa       text PRIMARY KEY,
  ten        text NOT NULL,
  website    text,
  tai_khoan  text,                                -- tài khoản của mình bên NCC (mã, email đăng nhập — KHÔNG mật khẩu)
  links      jsonb NOT NULL DEFAULT '[]'::jsonb,
  lien_he    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ghi_chu    text,
  cap_nhat   timestamptz NOT NULL DEFAULT now()
);
-- CJ: số liệu đọc thật từ CJ API setting/get 01/10/2026 (userNum CJ5884345, chủ Tuấn Nguyễn Hoàng, email ht***82@gmail.com); trang chủ kiểm 200.
-- Liên hệ (agent phụ trách) API không trả → để trống cho anh điền.
INSERT INTO shop_ncc (khoa, ten, website, tai_khoan, links, ghi_chu) VALUES
  ('cj', 'CJ Dropshipping', 'https://cjdropshipping.com', 'CJ5884345 · Tuấn Nguyễn Hoàng · ht***82@gmail.com (htuan82)',
   '[{"nhan": "Danh sách đơn", "url": "https://www.cjdropshipping.com/mine/dropshipping/orderList?orderType=3&childType=1"}]',
   'Đặt đơn, trả tiền, vận đơn, dispute qua API (khoá SHOP_CJ_TOKEN). CJ không cho biết người bán thật phía sau từng sản phẩm.')
ON CONFLICT (khoa) DO NOTHING;
