-- LƯỢT 2 CHO CREATIVE BỊ LUẬT RS TẮT (anh 26/11/2026: "Các creative này sẽ được lên camp mới ở khung giờ 22h tiếp ngay sau đó với kiểu lên camp còn lại …
-- Camp lượt này sẽ lên ở 1 tk khác. Đây là lượt 2 cho cùng 1 creative. Hãy thêm chỉ số đếm số lần creative được sử dụng.") — máy apps/etp/luot2.py ghi sổ này.
-- Một dòng mỗi creative gốc (mỗi creative chỉ có MỘT lượt 2). cr_moi = bản Ethopex mới cùng video mang chữ kiểu còn lại (chữ khác nên phải là creative Ethopex khác).
create table if not exists etp.luot2 (
  cr_goc     integer primary key,
  camp_goc   integer not null,
  content_id integer not null,
  lang       text,
  kieu_goc   text,
  bo_goc     text,
  cr_moi     integer,
  kieu_moi   text,
  bo_moi     text,
  camp_moi   integer,
  tt         text not null default 'dang',   -- dang (đang làm / làm dở, nhịp sau làm tiếp) · xong · bo (không đủ điều kiện, ghi ly) · loi (đã thử hết số lần)
  lan        integer not null default 0,     -- số lần đã thử lên camp
  ly         text,
  luc        timestamptz not null default now(),
  cap_nhat   timestamptz not null default now()
);
create index if not exists luot2_cr_moi on etp.luot2 (cr_moi) where cr_moi is not null;

-- CHỈ SỐ ĐẾM SỐ LẦN CREATIVE ĐƯỢC DÙNG: mỗi creative thuộc một dòng dõi (goc = creative lượt 1); lan_dung = số camp (nhà + team) đã lên của cả dòng dõi.
create or replace view etp.cr_lan_dung as
with dd as (
  select r.creative_id, coalesce(l.cr_goc, r.creative_id) goc
  from etp.creative r left join etp.luot2 l on l.cr_moi = r.creative_id
), n as (
  select dd.goc, count(*)::int n from etp.cr_co_camp k join dd using (creative_id) group by 1
)
select dd.creative_id, dd.goc, case when dd.goc <> dd.creative_id then 2 else 1 end luot, coalesce(n.n, 0) lan_dung
from dd left join n using (goc);
