-- SHOP — "Tham khảo" của một sản phẩm: trang ngoài bán cùng/gần mẫu (Amazon, Walmart, AliExpress…) để đọc review thật, so giá,
-- lấy ý cho mô tả/FAQ/bảng size. Hiện trong drawer sản phẩm /shop (anh chốt 01/10/2026). [{url, nguon, ghi_chu, khop, luc}]
--   khop: 'chua_xac_nhan' (tên gần giống, chưa so ảnh) | 'dung_mau' (đã so ảnh, cùng mẫu) | 'khac'
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS tham_khao jsonb NOT NULL DEFAULT '[]'::jsonb;
