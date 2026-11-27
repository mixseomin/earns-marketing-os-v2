-- CHỮ KIỂU (Kiên) MÁY SINH THEO PHIM (anh 27/11/2026: "Mày phải sinh luôn text cho kiểu Kiên lúc review Ảnh").
-- apps/etp/chu-kieu.json giữ bộ chữ viết tay (ưu tiên); phim chưa có → apps/etp/sinh-chu-kien.py sinh qua cổng AI chung, ghi ở đây.
-- Mọi chỗ đọc chữ kiểu đi qua MỘT hàm apps/etp/so_kieu.py (Python) / etp-cho-len.ts (etp2): sổ json ∪ bảng này.
create table if not exists etp.chu_kieu (
  content_id bigint not null,
  kieu text not null default 'kien',
  pt jsonb not null,             -- primaryTexts
  hl jsonb not null,             -- headlines
  de jsonb not null,             -- descriptions
  lang text,
  mo_hinh text,
  vnd numeric,
  tao timestamptz not null default now(),
  primary key (content_id, kieu)
);
