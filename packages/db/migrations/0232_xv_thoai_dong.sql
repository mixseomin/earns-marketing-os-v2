-- Thoại kiểu kịch bản phim (góp ý #1197, 09/10/2026): mỗi shot nhiều dòng [{nhan_vat, dien_xuat, loi, url?}]
-- — nhân vật nói · diễn xuất (nhìn lên, giơ tay…) · lời; url = file giọng của dòng đó. loi_thoai giữ bản ghép để tương thích.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS thoai jsonb NOT NULL DEFAULT '[]'::jsonb;
