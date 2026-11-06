-- CAMP CHỜ (anh 06/11/2026 "Các phim kiểu này chỉ có 1 camp đang chạy. Hãy lên sẵn camp chờ, show ra kể cả đang sx"): thay-the.py mở dòng etp.thay_the cả khi
-- phim chỉ 1 camp chạy ≥ 24 giờ mà camp còn khoẻ — kieu 'cho' (camp chờ) khác 'thay' (camp cũ sắp tắt); trang etp ghi "camp chờ" thay vì "thay #".
alter table etp.thay_the add column if not exists kieu text not null default 'thay';
