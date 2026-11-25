-- CREATIVE ĐÃ CÓ CAMP — MỘT NGUỒN cho etp2 (anh 25/11/2026: bấm ▶ Lên #113286 hai lần, nút báo "✓ đã gửi" nhưng nhan-ban từ chối
-- "đã có camp #108633 (team)"). etp2 chỉ xét etp.camp (nhà) trong khi nhan-ban (ethopex_api.creative_cu) xét cả etp.camp_ngoai (team)
-- → creative team đã dùng vẫn nằm hàng chờ ID và nút lên báo thành công giả. Mọi chỗ etp2 hỏi "creative này có camp chưa" đọc view này.
create or replace view etp.cr_co_camp as
  select creative_id, camp_id, false doi from etp.camp where creative_id is not null
  union all
  select creative_id, camp_id, true doi from etp.camp_ngoai where creative_id is not null;
create index if not exists camp_ngoai_creative_idx on etp.camp_ngoai (creative_id);
