-- PHÂN RÃ KỊCH BẢN (script breakdown — cách đoàn phim gắn thẻ mọi yếu tố từng cảnh: phục trang, tóc, trang điểm, phụ kiện, vết, đạo cụ, bối cảnh).
-- xv_tap.phan_ra: lần phân rã gần nhất của tập { luc, bam (mã băm chữ kịch bản + shot → biết khi nào phân rã đã CŨ), model, vnd, so_moi, ghi_chu[], khong_khop[] }.
-- xv_canh.phan_ra: phần của từng shot { luc, dung[] (mọi thành phần trong khung theo lượt phân rã), truoc { nhan_vat, bien_the } (gắn cũ — khôi phục được), khong_khop[] }.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS phan_ra jsonb;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS phan_ra jsonb;
