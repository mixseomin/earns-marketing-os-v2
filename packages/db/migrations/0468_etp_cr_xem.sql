-- XEM TRƯỚC CREATIVE LÚC SOẠN (etp2 › ngăn Creative của phim — anh 23/11/2026 "Chưa nhìn đc sp trc khi bấm sinh ra. Phải dùng cơ chế tập trung vào sp lúc thiết kế"):
-- mỗi lần anh đổi mẫu / chữ / ô ghim → xem_tt = 'cho' → máy dòng phim trên iMac (dung-mau.py --xem-soan) dựng ảnh tĩnh thật (không giọng, không nạp) → xem_anh.
-- etp.cr_khung = khung ứng viên của phim (máy trích từ 3 tập, AI xếp hạng) — thư viện "Khung phim" của bước Thành phần, ảnh nhỏ ở box3 /var/lib/etp-xem/<cid>/k/.
alter table etp.cr_soan add column if not exists xem_tt text, add column if not exists xem_anh text, add column if not exists xem_loi text,
  add column if not exists xem_yc timestamptz, add column if not exists xem_xong timestamptz;
create table if not exists etp.cr_khung (content_id integer not null, khoa text not null, tep text not null, tap text, so integer, cam_xuc text, nhan_vat text, hang integer,
  luc timestamptz not null default now(), primary key (content_id, khoa));
