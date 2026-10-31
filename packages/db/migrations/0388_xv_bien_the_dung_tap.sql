-- Trang phục / look theo TẬP: biến thể look (trang phục, tóc, trang điểm, kính, vết, trạng thái) có thể chỉ dùng cho một số tập (phim nhiều tập, tủ đồ
-- riêng mỗi tập). dung_tap = mảng SỐ TẬP (xv_tap.so) mà biến thể này dùng; NULL / rỗng = dùng cho MỌI tập (đồ xuyên suốt). Bảng Thiết kế sản xuất lọc theo
-- tập đang mở; lookMang lấy biến thể hợp tập làm bộ mặc định.
ALTER TABLE xv_bien_the ADD COLUMN IF NOT EXISTS dung_tap jsonb;
