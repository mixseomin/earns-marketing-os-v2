-- SHOP — đăng ký nhận tin ở chân trang mặt tiền ("Join Us & Get 10% OFF", khuôn orabra) + mã giảm áp ở checkout (01/10/2026).
-- Mã giảm khai ở shop_cua_hang.mat_tien.ma_giam [{ma, pt}]; phiên thanh toán ghi mã đã áp để máy chủ tính lại đúng số tiền.
CREATE TABLE IF NOT EXISTS shop_dang_ky (
  id          serial PRIMARY KEY,
  cua_hang_id integer NOT NULL REFERENCES shop_cua_hang(id),
  email       text NOT NULL,
  nguon       text,                                  -- trang khách đứng lúc đăng ký
  tao_luc     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cua_hang_id, email)
);
ALTER TABLE shop_thanh_toan ADD COLUMN IF NOT EXISTS ma_giam text;
