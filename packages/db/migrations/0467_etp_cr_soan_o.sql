-- Ô thành phần đã ghim của bản soạn creative (etp2 › ngăn Creative của phim, bước Thành phần — anh 23/11/2026):
-- { "<mã ô>": { nguon, id, ten, anh, src, chu } } — ô không có khoá thì máy dựng chọn theo quy tắc của ô (etp-mau-cr.json › mau[].o[].luat).
create table if not exists etp.cr_soan (id serial primary key, content_id integer not null, mau text, cau text, nhan text, chu_dau text,
  trang_thai text not null default 'nhap', ghi text, tv_id integer, creative_id integer, ai text, tao timestamptz not null default now(), cap_nhat timestamptz not null default now());
alter table etp.cr_soan add column if not exists o jsonb;
