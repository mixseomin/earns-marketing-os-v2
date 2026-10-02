-- SHOP — CỔNG THANH TOÁN nhiều loại (anh chốt 02/10/2026: "có cả Payoneer…, sau thêm PayPal, PingPong nếu cần").
-- Hai VAI: 'thu' = thu tiền khách (Stripe, PayPal) · 'nhan' = nơi tiền về (Payoneer, PingPong — Stripe/PayPal rút về đây).
-- Dòng tiền: cổng thu → ve_cong_id (rút về cổng nhận nào). Một shop dùng được NHIỀU cổng (Stripe + PayPal) → bảng nối shop_cong_shop
-- (thay shop_cua_hang.cong_id của 0213 — cột đó thôi dùng, giữ nguyên dữ liệu).
-- Cổng có API (hiện: Stripe) máy tự đọc sức khoẻ; cổng chưa có API: trạng thái anh tự ghi + ngày kiểm (lib/shop/cong-luat.ts).
-- tai_khoan: CHỈ email/mã tài khoản — không mật khẩu, không số thẻ/số tài khoản ngân hàng (server action từ chối).
ALTER TABLE shop_cong ADD COLUMN IF NOT EXISTS vai text NOT NULL DEFAULT 'thu';
ALTER TABLE shop_cong ADD COLUMN IF NOT EXISTS tai_khoan text;
ALTER TABLE shop_cong ADD COLUMN IF NOT EXISTS link text;               -- trang quản trị của cổng
ALTER TABLE shop_cong ADD COLUMN IF NOT EXISTS ve_cong_id integer REFERENCES shop_cong(id);
ALTER TABLE shop_cong ADD COLUMN IF NOT EXISTS trang_thai_tay text;     -- on · can_xem · khoa (cổng chưa có API)
ALTER TABLE shop_cong ADD COLUMN IF NOT EXISTS kiem_luc timestamptz;    -- lần anh kiểm tay gần nhất
CREATE TABLE IF NOT EXISTS shop_cong_shop (
  cong_id     integer NOT NULL REFERENCES shop_cong(id),
  cua_hang_id integer NOT NULL REFERENCES shop_cua_hang(id),
  PRIMARY KEY (cong_id, cua_hang_id)
);
INSERT INTO shop_cong_shop (cong_id, cua_hang_id) SELECT cong_id, id FROM shop_cua_hang WHERE cong_id IS NOT NULL ON CONFLICT DO NOTHING;
