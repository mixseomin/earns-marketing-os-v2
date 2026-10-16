-- DÙNG LẠI CLIP (anh 17/10/2026): mỗi BỘ HÌNH (cặp concept × template × một biến thể diễn viên) sản xuất MỘT phim gốc; các creative cùng bộ hình
-- xuất từ clip của phim gốc, chỉ thay chữ màn + giọng (apps/xuong-video/src/lib/xuong-video/xuat-creative.ts — cùng khuôn lồng tiếng long-tieng.ts).
ALTER TABLE xv_bien_the_hinh ADD COLUMN IF NOT EXISTS phim_id integer;   -- phim gốc của bộ hình (phim đầu tiên tạo từ bộ hình này)
ALTER TABLE xv_creative ADD COLUMN IF NOT EXISTS xuat jsonb;             -- bản xuất của creative: { url, luc, job, giay, canh_bao }
