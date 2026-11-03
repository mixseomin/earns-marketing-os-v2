-- BỘ CREATIVE ĐỦ LOẠI CHO MỘT PHIM (anh 03/11/2026 "phải làm đủ 1 bộ creative cho mọi loại nội dung trước. Chưa lên camp"):
-- một phim chạy cùng lúc nhiều dòng, MỖI LOẠI nội dung một dòng (tập nguyên LT · cảnh cuối CC · kể chuyện KT …). Trước: một phim một dòng đang chạy.
drop index if exists etp.dong_phim_mot;
create unique index if not exists dong_phim_mot on etp.dong_phim (content_id, loai) where trang_thai = 'chay';
