-- SHOP — ảnh quảng cáo đối thủ lưu VĨNH VIỄN (anh cần xem chi tiết creative ngay trong /shop › Đối thủ, 02/10/2026).
-- Link fbcdn của Thư viện quảng cáo là link ký, hết hạn sau vài ngày → máy tải về media_assets (category 'doi_thu', theo dự án của shop),
-- phục vụ qua /api/media/<id>/raw (có thu nhỏ ?w=). lib/shop/doi-thu-media.ts, cron /api/cron/shop gọi mỗi nhịp.
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS media_id bigint REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS media_loi text;   -- tải hỏng (link hết hạn…) — nhịp sau không thử lại
