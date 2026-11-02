-- TRANG PHIM TRONG WORKSPACE ETHOPEX (anh 02/11/2026: "Đồng bộ và làm theo đề xuất vào đây" — tab Phim etp.on.tc):
-- phim phải được "thêm content" vào workspace của người chạy (api-multi-be /api/v2/movie/contents) thì camp mới có trang đích
-- (Are you over 18? → detail → review → tập 1 trên ReelShort / NetShort / DramaBox). Ethopex tự sinh mô tả + cốt truyện, có lúc trượt
-- (174841 Merman 02/11). apps/etp/trang_phim.py đồng bộ mỗi lượt dong-bo; cổng nhan-ban.py + cảnh báo + tab Phim đọc view trang_phim_v.
create table if not exists etp.trang_phim (
  content_id bigint primary key,          -- mã bản trong workspace (Ethopex movie content)
  ref_id bigint,                          -- mã phim thư viện = content_id của camp
  nguoi_id int,                           -- user Ethopex = etp.tai_khoan.nguoi_id (117 nhà · 115 Sơn · 116 Kiên)
  nguoi text,
  ten text,
  locale text,
  nguon text,                             -- host trang tập 1 (www.reelshort.com, netshort.com…)
  redirect_url text,
  mo_ta int not null default 0,           -- số ký tự description
  cot_truyen int not null default 0,      -- số ký tự storyline
  tom_tat int not null default 0,         -- số ký tự short_description
  anh text,
  tao timestamptz,
  sua timestamptz,                        -- updated_at phía Ethopex
  link_ok boolean,                        -- null = chưa kiểm / kiểm không được (403, mạng); false = 404 / 410
  link_luc timestamptz,
  link_loi text,
  cap_nhat timestamptz not null default now()
);
create index if not exists trang_phim_ref on etp.trang_phim (ref_id);

create or replace view etp.trang_phim_v as
select t.*, array_remove(array[
    case when t.mo_ta = 0 then 'mô tả' end,
    case when t.cot_truyen = 0 then 'cốt truyện' end,
    case when coalesce(t.anh, '') = '' then 'ảnh bìa' end,
    case when coalesce(t.redirect_url, '') = '' then 'link tập 1' end,
    case when t.link_ok is false then 'link tập 1 chết' end], null) thieu
from etp.trang_phim t;
