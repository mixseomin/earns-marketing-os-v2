-- THƯ VIỆN CREATIVE THEO PHIM (anh 29/10/2026: "xây dựng thư viện creative cho các film để sau này chia sẻ cho mọi người dùng" + "việc sinh video kể truyện giờ free
-- nên tạo cơ chế sinh cho hợp lý về tài nguyên và hiệu quả"). Trang etp › Thư viện = creative đã lên Ethopex (etp.creative, có số chạy) + các bản ở đây CHƯA lên
-- (bản kể chuyện máy sinh bằng VideoExpress, $0). Lên Ethopex rồi thì ghi creative_id → trang gộp với số chạy thật của creative đó.
-- trang_thai: dang_sinh (máy đang làm) · san_sang (qua cổng, chờ người chọn lên camp) · da_len (đã thành creative) · loai (người / cổng loại)
create table if not exists etp.thu_vien (
  id          bigserial primary key,
  content_id  integer not null,
  creative_id integer unique,
  dang        text not null default 'ke_chuyen_vx',
  lang        text,
  ten         text,
  video       text,
  anh         text,
  giay        numeric,
  nguon       text not null default 'videoexpress',
  tap_id      integer,
  chu_qc      jsonb not null default '{}'::jsonb,
  trang_thai  text not null default 'dang_sinh',
  ghi         text,
  chi_vnd     numeric not null default 0,
  tao         timestamptz not null default now(),
  cap_nhat    timestamptz not null default now()
);
create index if not exists etp_thu_vien_content on etp.thu_vien (content_id);
create index if not exists etp_thu_vien_tt on etp.thu_vien (trang_thai);
