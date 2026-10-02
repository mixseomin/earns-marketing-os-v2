-- SHOP — tách dữ liệu DEMO khỏi dữ liệu THẬT (anh yêu cầu 02/10/2026: "nhìn demo và nhìn data thật không bị lẫn").
-- Cờ đặt ở GỐC (cửa hàng, nhà cung cấp); mọi thứ khác (đơn, sản phẩm, biến thể, danh mục, biến động, hồ sơ, hạ tầng QC…) suy theo gốc
-- trong lib/shop/che-do.ts — không đánh cờ từng dòng con, không đoán theo tên "demo".
ALTER TABLE shop_cua_hang ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;
ALTER TABLE shop_ncc ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;
UPDATE shop_cua_hang SET demo = true WHERE khoa IN ('demo', 'demo-bra');
UPDATE shop_ncc SET demo = true WHERE khoa IN ('cj_demo', 'ali_lumi_demo');
