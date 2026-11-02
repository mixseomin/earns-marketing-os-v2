-- KÊNH LÀ SẢN PHẨM (anh 02/11/2026: "kênh này coi là sản phẩm (video full)… phải show và chỉ số kênh này vào tab tài sản ở mos2"):
-- máy có la_san_pham = true hiện ở mos2 › Tài sản › Kênh sản phẩm; số đo hằng ngày ghi kenh_so_ngay (kenh youtube, san_pham 'may:<mã>') bởi may-dung.mts --so-kenh.
ALTER TABLE xv_may ADD COLUMN IF NOT EXISTS la_san_pham boolean NOT NULL DEFAULT false;
UPDATE xv_may SET la_san_pham = true WHERE ma = 'yesterdays-news-tonight';
