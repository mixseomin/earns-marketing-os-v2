-- 0405 lỡ đặt tên etp.thu_vien — trùng bảng THƯ VIỆN CREATIVE đã có (etp-doc đọc), "create table if not exists" bỏ qua nên chưa có gì ghi vào đó.
-- Bảng mã phim → group_id + poster cho ngăn phim (apps/etp/thu_vien_phim.py ghi, actions/etp-phim.ts đọc) đặt đúng tên riêng:
create table if not exists etp.thu_vien_phim (
  content_id bigint primary key,
  nhom_id bigint,
  ten text,
  locale text,
  anh text,
  url text,
  tao timestamptz,
  cap_nhat timestamptz not null default now()
);
