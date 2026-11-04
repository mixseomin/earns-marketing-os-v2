-- Số theo giờ của TỪNG CAMP (anh 05/11/2026: bấm / rê một ngày trên Cây camp thấy diễn biến tăng giảm trong ngày — "1 cái chart").
-- etp.so_gio chỉ có phim × giờ; báo cáo dong-bo vốn đã nhóm theo camp nên ghi thêm ở đây. gio = giờ ngày Ethopex (0 = 07:00 VN).
create table if not exists etp.so_gio_camp (
  camp_id bigint not null,
  ngay date not null,
  gio smallint not null,
  chi numeric not null default 0,
  thu numeric not null default 0,
  cap_nhat timestamptz not null default now(),
  primary key (camp_id, ngay, gio)
);
create index if not exists etp_so_gio_camp_ngay on etp.so_gio_camp (ngay);
