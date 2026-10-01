-- SHOP — thông tin NGUỒN của từng sản phẩm bên nhà cung cấp (CJ product/query), làm mới mỗi ngày: tab /shop › Nhà cung cấp hiện
-- NCC → sản phẩm nguồn (mã, tên bên CJ, SKU, giá vốn CJ, số biến thể, biến thể của mình có khớp vid CJ không) → trao đổi (anh yêu cầu 01/10/2026).
-- CJ không trả tên người bán thật (supplierName trống) — nhà cung cấp mình làm việc là CJ.
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS ncc_info jsonb;     -- {pid, ten, sku, gia_tu, gia_den, so_bien_the, vids[], listed, supplier_id, loi?}
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS ncc_luc timestamptz; -- lần đọc gần nhất
