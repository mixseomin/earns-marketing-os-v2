-- PHIM ROI CAO CẢ ĐỘI → LÊN 5 CAMP MỘT LẦN (anh 06/11/2026 "Phim có roi cao của cả đội thì có thể lên cùng 5 camp mới mỗi lần", cùng lúc bỏ luật không trùng phim với đội
-- và cổng bão hoà). Phim đội lãi = chi nhà + đội ≥ chi$ và ROI ≥ roi% trên `ngay` ngày Ethopex (UTC) đã khép gần nhất (đo 06/11/2026: 30$ / 30% / 3 ngày → 11 phim).
-- Máy lên camp (apps/cty/worker/ethopex.mjs khối PHIM MỚI) đọc cột so_len của etp.cho_len_v: creative của phim đội lãi lên so_camp camp $1 cùng lúc, phim khác 1 camp.
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('len_doi_lai', '{"chi": 30, "roi": 30, "ngay": 3, "so_camp": 5}'::jsonb,
  'phim ROI cao cả đội (nhà + đội, ngày đã khép) → máy lên so_camp camp mới một lần cho creative phim đó — view etp.phim_doi_lai / etp.cho_len_v.so_len', 'migration 0434')
on conflict (khoa) do nothing;

create or replace view etp.phim_doi_lai as
with g as (select coalesce((gia_tri->>'chi')::numeric, 30) chi, coalesce((gia_tri->>'roi')::numeric, 30) roi, coalesce((gia_tri->>'ngay')::int, 3) ngay
           from (select (select gia_tri from etp.cau_hinh where khoa = 'len_doi_lai') gia_tri) x),
s as (
  select c.content_id, s.chi, s.thu, false doi from etp.so_ngay s join etp.camp c using (camp_id), g where s.ngay between current_date - g.ngay and current_date - 1 and c.content_id > 0
  union all
  select k.content_id, s.chi, s.thu, true from etp.so_ngay_ngoai s join etp.camp_ngoai k using (camp_id), g where s.ngay between current_date - g.ngay and current_date - 1 and k.content_id > 0)
select s.content_id, round(sum(s.chi)::numeric, 2) chi, round(sum(s.thu)::numeric, 2) thu, round(((sum(s.thu) - sum(s.chi)) / nullif(sum(s.chi), 0) * 100)::numeric) roi,
  round(sum(s.chi) filter (where s.doi)::numeric, 2) chi_doi
from s, g group by s.content_id, g.chi, g.roi
having sum(s.chi) >= g.chi and (sum(s.thu) - sum(s.chi)) / nullif(sum(s.chi), 0) * 100 >= g.roi;

create or replace view etp.cho_len_v as
with x as (
  select r.creative_id, r.content_id, coalesce(r.dang, '') dang, coalesce(r.lang, 'en') lang, coalesce(r.lo, '') lo, coalesce(r.tu, 0) tu, coalesce(r.den, 0) den, r.tu_choi,
    (select max(h.luc) from etp.cham h where h.creative_id = r.creative_id) cham_luc,
    exists (select 1 from etp.phim_nhan_v n where n.content_id = r.content_id and n.trang_thai = 'giu') nhan,
    exists (select 1 from etp.dong_phim d where d.content_id = r.content_id and d.trang_thai <> 'huy') co_dong,
    exists (select 1 from etp.phim_nhan_v n where n.content_id = r.content_id and n.trang_thai = 'giu' and n.nguoi_id not in (select nguoi_id from etp.tai_khoan where nha)) doi_nhan,
    exists (select 1 from etp.camp c where c.content_id = r.content_id) co_camp_phim,
    exists (select 1 from etp.camp c where c.content_id = r.content_id and c.trang_thai = 'ACTIVE') phim_chay,
    exists (select 1 from etp.camp c join etp.creative k on k.creative_id = c.creative_id where c.content_id = r.content_id and k.dang = r.dang) co_dang,
    (select (b.gia_tri->(r.creative_id::text)->>'luc')::timestamptz from etp.cau_hinh b where b.khoa = 'phim_moi_bo_qua') bq_luc,
    (select b.gia_tri->(r.creative_id::text)->>'loi' from etp.cau_hinh b where b.khoa = 'phim_moi_bo_qua') bq_loi
  from etp.creative r join etp.cham_cong g on g.creative_id = r.creative_id
  where g.duoc_len and r.content_id is not null and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id)
), y as (
  select x.*, case
    when tu_choi is not null then 'creative đã bị từ chối'
    when cham_luc is null or cham_luc <= now() - interval '3 days' then 'chấm đã quá 3 ngày — máy chỉ tự lên creative chấm trong 3 ngày gần nhất'
    when co_dong and dang <> 'ảnh tĩnh' then 'phim có dòng phim tự động — dòng phim lên camp'
    when doi_nhan then 'phim người trong đội đang nhận — lên ở tài khoản người nhận'
    when co_camp_phim and not (dang in ('kể chuyện', 'ảnh tĩnh') and phim_chay and not co_dang) then case
      when dang in ('kể chuyện', 'ảnh tĩnh') and co_dang then 'phim đã có camp ' || dang
      when dang in ('kể chuyện', 'ảnh tĩnh') then 'phim không còn camp nào đang chạy'
      else 'phim đã từng có camp — máy không tự lên lại phim đã bị tắt' end
    when bq_luc > now() - interval '24 hours' then 'lần trước lên lỗi: ' || coalesce(bq_loi, 'không rõ') || ' — máy thử lại sau ' || to_char((bq_luc + interval '24 hours') at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM')
  end ly_do from x)
-- thứ tự = thứ tự máy lấy (phim đang NHẬN trước · kể chuyện / ảnh tĩnh làm theo lệnh · rồi chấm sớm trước)
select y.*, case when ly_do is null then (row_number() over (partition by ly_do is null order by nhan desc, (dang in ('kể chuyện', 'ảnh tĩnh')) desc, cham_luc))::int end hang,
  -- so_len = số camp máy lên MỘT LẦN cho creative này: phim ROI cao cả đội (etp.phim_doi_lai) → len_doi_lai.so_camp, còn lại 1
  case when exists (select 1 from etp.phim_doi_lai d where d.content_id = y.content_id)
    then coalesce((select (gia_tri->>'so_camp')::int from etp.cau_hinh where khoa = 'len_doi_lai'), 5) else 1 end so_len
from y;
