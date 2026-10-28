-- SỐ THẬT TỪNG LUẬT (anh 29/10/2026: "các luật cũng cần định kỳ review lại dựa vào số liệu thực tế … một bản luật với điều kiện hiện tại + số liệu thực tế + đề xuất")
-- apps/etp/so-luat.py ghi mỗi giờ: kết quả sau mỗi lần máy luật làm (tăng / giảm / tắt / nhân bản), camp đang chạm, đề xuất có số
create table if not exists etp.so_luat (
  ma   text primary key,
  luc  timestamptz not null default now(),
  so   jsonb not null default '{}'::jsonb
);
