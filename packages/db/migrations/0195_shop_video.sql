-- SHOP — video sản phẩm, hiện trong khối Description của trang sản phẩm (anh chốt 01/10/2026: "trang sản phẩm gốc có video thì thêm vào mô tả").
-- Nguồn: NCC (CJ product/query → productVideo) gieo MỘT lần lúc video_luc còn trống; sửa ở drawer /shop thì sổ là gốc (video_luc = lúc sửa).
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS video jsonb NOT NULL DEFAULT '[]'::jsonb;   -- ["https://….mp4" | youtube]
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS video_luc timestamptz;                      -- lần đã hỏi NCC / sửa tay; NULL = chưa hỏi
