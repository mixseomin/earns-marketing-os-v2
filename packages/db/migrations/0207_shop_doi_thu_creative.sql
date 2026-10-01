-- SHOP — chi tiết CREATIVE của quảng cáo đối thủ (anh yêu cầu 02/10/2026: "creative ads… mọi thứ cụ thể").
-- Đọc từ Thư viện quảng cáo Meta / TikTok Creative Center; chép nguyên văn, không diễn giải.
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS tieu_de text;        -- headline dưới media
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS cta text;            -- nút: Shop Now / Learn More …
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS dinh_dang text;      -- video · ugc_video · anh · carousel · slideshow
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS goc text;            -- góc bán (giảm đau, bác sĩ khuyên, khuyến mãi, lời khen khách…)
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS uu_dai text;         -- ưu đãi trên QC (mua 2 tặng 1, 50%, free ship)
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS media text;          -- link ảnh / thumbnail video thật đã thấy
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS so_phien_ban integer; -- số phiên bản Meta gộp chung một QC
