-- BẢNG TRANG PHỤC: hoàn cảnh dùng của một biến thể (văn phòng, ở nhà, tiệc, đêm… — so với nơi / lúc của phân cảnh, bang-trang-phuc.ts). 17/10/2026.
ALTER TABLE xv_bien_the ADD COLUMN IF NOT EXISTS dung_cho jsonb;
