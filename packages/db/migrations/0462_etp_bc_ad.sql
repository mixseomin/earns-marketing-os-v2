-- KHO THÔ REPORT ETHOPEX THEO AD (anh 23/11/2026 "cơ bản là kéo hết về" — etp:keo-het-report-2311, mở rộng #172 etp:qc-adsense-camp-2311).
-- Trước: máy chỉ kéo ~15 cột report (camp / phim / nước) → không so được theo MIỀN (maybic vs marcusbeilby), LANDING PAGE, PAGE FB, TK QC, mất khách click → trang.
-- Nay kéo MỌI cột đếm / tiền ở hạt nhỏ nhất (ad × nước × ngày) + bảng chiều của ad; mọi tỉ lệ tính lại trong view từ số đếm (không lưu cột tỉ lệ của report).
--  · etp.bc_ad_ngay  : ngày × ad × nước, 17 cột đếm / tiền — apps/etp/dong-bo.py ghi đè 3 ngày gần nhất mỗi lượt + lấp ngược dần từ 19/10
--  · etp.bc_ad       : chiều của ad (camp, người, team, miền, landing, phim, tk QC, Page, pixel…) — giá trị mới nhất
--  · etp.bc_ad_doi   : lịch sử đổi chiều của ad (trigger, mỗi cột đổi một dòng; bỏ active_day vì tăng mỗi ngày)
--  · etp.bc_v        : fact × chiều + tỉ lệ (ROI, IRPM, fill, page RPM, mất click → traffic, mất traffic → lượt xem) — nhịp 2–3 của #172 đọc ở đây
-- Bảng #172 nhịp 1 (so_pheu.luot_xem / xin_qc, so_gio.*) giữ nguyên cho màn đang dùng; kho số mới không tạo bảng thứ hai cho cùng việc.

create table if not exists etp.bc_ad_ngay (
  ngay date not null,
  ad_id bigint not null,
  geo text not null default '',                 -- mã nước 2 chữ (report country_code), '' khi report không có nước
  cost numeric not null default 0,              -- Facebook: tiền chi (supply)
  revenue numeric not null default 0,           -- doanh thu (demand)
  supply_conversion_value numeric not null default 0,
  supply_conversions int not null default 0,
  conversions int not null default 0,
  supply_impressions int not null default 0,    -- Facebook: lượt hiển thị
  supply_clicks int not null default 0,         -- Facebook: lượt bấm
  traffics int not null default 0,              -- lượt về tới máy theo click ID
  page_views int not null default 0,            -- lượt xem trang phim
  ad_requests int not null default 0,           -- AdSense: lần xin quảng cáo
  impressions int not null default 0,           -- AdSense: quảng cáo hiện
  conversions_rt int not null default 0,
  clicks int not null default 0,                -- AdSense: lượt bấm quảng cáo
  error_count int not null default 0,
  all_traffic int not null default 0,
  pre_revenue numeric not null default 0,       -- doanh thu từ tên miền con pre*
  chn_revenue numeric not null default 0,       -- doanh thu từ tên miền con chn*
  cap_nhat timestamptz not null default now(),
  primary key (ngay, ad_id, geo)
);
create index if not exists bc_ad_ngay_ad on etp.bc_ad_ngay (ad_id, ngay);

create table if not exists etp.bc_ad (
  ad_id bigint primary key,
  ad_external_id text, ad_name text, ad_status text, ad_delivery text,
  ad_group_id bigint, ad_group_name text,
  campaign_id bigint, campaign_name text, external_campaign_id text, campaign_link text, daily_budget numeric, campaign_source_status text, campaign_delivery text, active_day int,
  external_account_id text, nha boolean,     -- nha = tài khoản QC nhà (EA.EXT, cùng cách dong-bo tách so_ngay / so_ngay_ngoai)
  user_id int, user_email text, user_username text,
  team_id int, team_name text, workspace_id int, workspace_name text,
  traffic_source text, domain text, sub_domain text, sub_domains text[],   -- sub_domain = miền con của dòng gần nhất / chi nhiều nhất; sub_domains = mọi miền con ad từng chạy (report tách pre* / chn*)
  landing_page_id bigint,
  content_group_id bigint, content_group_name text, content_source text, content_source_url text,
  content_type_id int, content_type_name text, tag text,
  content_creator_id int, content_creator_username text,
  bm_supply_id text, account_supply_id text, account_supply_name text,
  page_fb_id text, page_fb_name text, pixel_id text, pixel_name text,
  ngay_dau date, ngay_cuoi date,              -- ngày đầu / cuối ad có dòng report đã kéo
  cap_nhat timestamptz not null default now()
);
create index if not exists bc_ad_camp on etp.bc_ad (campaign_id);
create index if not exists bc_ad_domain on etp.bc_ad (domain);

create table if not exists etp.bc_ad_doi (
  id bigserial primary key,
  ad_id bigint not null,
  luc timestamptz not null default now(),
  cot text not null,
  cu text, moi text
);
create index if not exists bc_ad_doi_ad on etp.bc_ad_doi (ad_id, luc);

-- lịch sử đổi: so từng cột cũ / mới (trừ cột sổ sách + active_day tăng mỗi ngày); giá trị mới rỗng không ghi đè giá trị cũ (dòng report thiếu chiều)
create or replace function etp.bc_ad_ghi_doi() returns trigger language plpgsql as $f$
declare k text; a jsonb := to_jsonb(old); b jsonb := to_jsonb(new); nd date; sd text[];
begin
  nd := least(old.ngay_dau, new.ngay_dau);
  sd := (select array_agg(distinct s order by s) from unnest(coalesce(old.sub_domains, '{}') || coalesce(new.sub_domains, '{}')) s where s <> '');
  -- lấp ngược (dòng report CŨ hơn cái đã có) → giữ nguyên chiều hiện tại, chỉ nới ngày đầu + gộp miền con
  if old.ngay_cuoi is not null and new.ngay_cuoi < old.ngay_cuoi then
    new := old; new.ngay_dau := nd; new.sub_domains := sd; return new;
  end if;
  for k in select jsonb_object_keys(b) loop
    if k in ('cap_nhat', 'active_day', 'ngay_dau', 'ngay_cuoi', 'sub_domains') then continue; end if;
    if (b->k) is distinct from (a->k) then
      -- to_jsonb(null) là JSON null (không phải SQL NULL) → so bằng ->> (cả null lẫn '')
      if coalesce(b->>k, '') = '' then new := jsonb_populate_record(new, jsonb_build_object(k, a->k)); continue; end if;
      insert into etp.bc_ad_doi (ad_id, cot, cu, moi) values (new.ad_id, k, a->>k, b->>k);
    end if;
  end loop;
  new.ngay_dau := nd; new.ngay_cuoi := greatest(old.ngay_cuoi, new.ngay_cuoi); new.sub_domains := sd;
  return new;
end $f$;
drop trigger if exists bc_ad_doi_t on etp.bc_ad;
create trigger bc_ad_doi_t before update on etp.bc_ad for each row execute function etp.bc_ad_ghi_doi();

-- fact × chiều + tỉ lệ tính từ số đếm (công thức theo /api/v1/report/columns)
create or replace view etp.bc_v as
select f.*, a.ad_name, a.ad_status, a.ad_group_id, a.campaign_id, a.campaign_name, a.daily_budget, a.external_account_id,
       a.user_id, a.user_username, coalesce(a.nha, false) as nha, a.team_name, a.workspace_name,
       a.traffic_source, a.domain, a.sub_domain, a.landing_page_id, a.content_group_id, a.content_group_name, a.content_source,
       a.content_type_name, a.tag, a.content_creator_username, a.bm_supply_id, a.account_supply_id, a.account_supply_name,
       a.page_fb_id, a.page_fb_name, a.pixel_id, a.pixel_name,
       f.revenue - f.cost as profit,
       case when f.cost > 0 then round((f.revenue - f.cost) / f.cost * 100, 1) end as roi,
       case when f.impressions > 0 then round(f.revenue / f.impressions * 1000, 2) end as irpm,
       case when f.page_views > 0 then round(f.revenue / f.page_views * 1000, 2) end as page_rpm,
       case when f.ad_requests > 0 then round(f.impressions::numeric / f.ad_requests * 100, 1) end as fill_rate,
       case when f.supply_clicks > 0 then round((f.supply_clicks - f.traffics)::numeric / f.supply_clicks * 100, 1) end as lost_traffic_rate,
       case when f.traffics > 0 then round((f.traffics - f.page_views)::numeric / f.traffics * 100, 1) end as lost_pageview_rate,
       case when f.supply_clicks > 0 then round(f.cost / f.supply_clicks, 4) end as cpc,
       case when f.supply_impressions > 0 then round(f.cost / f.supply_impressions * 1000, 2) end as cpm,
       case when f.supply_impressions > 0 then round(f.supply_clicks::numeric / f.supply_impressions * 100, 2) end as supply_ctr
from etp.bc_ad_ngay f left join etp.bc_ad a using (ad_id);

comment on table etp.bc_ad_ngay is 'Report Ethopex thô: ngày × ad × nước, mọi cột đếm / tiền (anh 23/11/2026 "kéo hết về") — tỉ lệ ở view etp.bc_v';
comment on table etp.bc_ad is 'Chiều của ad từ report Ethopex (giá trị mới nhất; lịch sử đổi ở etp.bc_ad_doi)';
comment on view etp.bc_v is 'Report Ethopex theo ad × nước × ngày + mọi chiều + tỉ lệ tính lại (ROI, IRPM, page RPM, fill, mất click/traffic, CPC, CPM)';
