-- SHOP — phiên khách ghi thêm thiết bị (anh so với trang đơn Shopdy 02/10/2026): trình duyệt + hệ điều hành (đọc user-agent ở máy chủ),
-- ngôn ngữ, múi giờ, màn hình (trình duyệt gửi). VẪN KHÔNG lưu IP — thay bằng so nước theo IP (cf-ipcountry, đã có) với nước giao hàng ở drawer đơn.
ALTER TABLE shop_phien ADD COLUMN IF NOT EXISTS trinh_duyet text;
ALTER TABLE shop_phien ADD COLUMN IF NOT EXISTS he_dieu_hanh text;
ALTER TABLE shop_phien ADD COLUMN IF NOT EXISTS ngon_ngu text;
ALTER TABLE shop_phien ADD COLUMN IF NOT EXISTS mui_gio text;
ALTER TABLE shop_phien ADD COLUMN IF NOT EXISTS man_hinh text;
CREATE INDEX IF NOT EXISTS shop_phien_so_don_idx ON shop_phien (cua_hang_id, so_don) WHERE so_don IS NOT NULL;
