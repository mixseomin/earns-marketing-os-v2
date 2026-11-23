-- MÁY DỊCH SẴN (anh 23/11/2026: "Phần dịch thì phải làm ngay từ lúc sinh ra creative !! Nếu chưa dịch thì dịch 1 loạt luôn. Chỉ các creative đang, chuẩn bị và sẽ chạy !!").
-- apps/etp2/scripts/dich-truoc.mts (mỗi lượt etp-dong-bo) dịch mọi chữ ngoại ngữ của thẻ creative vào etp.dich; bảng này ghi creative đã dịch đủ lúc nào —
-- bản chấm (etp.cham.luc) hay chữ QC (etp.bai_cr.luc) mới hơn mốc này thì máy dịch lại phần chữ mới (vd chép lại giọng → hook đổi).
create table if not exists etp.dich_cr (
  creative_id int primary key,
  luc timestamptz not null default now(),
  so_chu int not null default 0,      -- số đoạn chữ ngoại ngữ của thẻ
  loi text                            -- lượt dịch lỗi (null = đủ)
);
