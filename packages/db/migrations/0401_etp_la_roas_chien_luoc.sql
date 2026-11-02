-- NHẬN CAMP ROAS THEO CHIẾN LƯỢC THẦU THẬT (anh 02/11/2026: "đổi đi để nhận diện đầy đủ. Camp của Kiên nhiều cái ko set tên"):
-- Ethopex trả source_bidding_strategy cho mọi camp (LOWEST_COST_WITH_MIN_ROAS = camp ROAS). Tên chỉ dùng khi chưa có chiến lược (dòng cũ chưa đồng bộ).
-- Cột la_roas tính sẵn cho cả kho nhà lẫn kho team — mọi luật / màn lọc qua cột này (cong.py la_roas · lib/etp-roas.ts cùng luật).
alter table etp.camp_ngoai add column if not exists chien_luoc text;
alter table etp.camp add column if not exists la_roas boolean generated always as (case when chien_luoc is not null then chien_luoc = 'LOWEST_COST_WITH_MIN_ROAS'
  else coalesce(ten, '') like '★%' or coalesce(ten, '') like '% duplicate by %' or coalesce(ten, '') ~ '(^|[\s_(])ROAS[0-9.]*($|[\s_)])' end) stored;
alter table etp.camp_ngoai add column if not exists la_roas boolean generated always as (case when chien_luoc is not null then chien_luoc = 'LOWEST_COST_WITH_MIN_ROAS'
  else coalesce(ten, '') like '★%' or coalesce(ten, '') like '% duplicate by %' or coalesce(ten, '') ~ '(^|[\s_(])ROAS[0-9.]*($|[\s_)])' end) stored;
