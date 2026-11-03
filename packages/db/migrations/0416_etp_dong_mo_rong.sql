-- DÒNG MỞ RỘNG (anh 04/11/2026: "thêm 1 nút ở dòng film … mở ra form để chọn: số camp mới, thể loại film → submit là xong. Còn lại cho tab SX xử lý"):
-- so_camp > 0 = dòng mở rộng phim ĐANG CHẠY — bỏ qua nhận / trang / soát poster (phim đã live), sản xuất phần thiếu, lên đủ so_camp camp (miễn luật một camp mỗi lần
-- vì anh bấm chọn số), xong khi camp chạy. Máy: apps/etp/dong_phim.py.
alter table etp.dong_phim add column if not exists so_camp integer;
