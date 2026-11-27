-- etp2 phiếu lên camp (anh 27/11/2026): anh chọn bộ tài khoản lên camp (null = máy chọn: etp.cau_hinh bo_phim_moi)
alter table etp.phieu_len add column if not exists bo text;
-- chữ QC (primary / headline / description) của creative ĐỘI đang có camp lãi 7 ngày — dong-bo.py đọc /api/v1/creatives/<id>.asset_spec;
-- phiếu lên camp hover dòng chữ hiện "mẫu đang thắng của Kiên và đội" (anh 27/11/2026)
create table if not exists etp.chu_doi (
  creative_id int primary key,
  content_id  int,
  nguoi       text,
  pt jsonb not null default '[]', hl jsonb not null default '[]', de jsonb not null default '[]',
  lay timestamptz not null default now(),
  cap_nhat timestamptz not null default now()
);
