-- LÊN CAMP MỚI 100/NGÀY THEO CÁCH KIÊN (anh 07/11/2026 "Áp cả 2 cho cả các phim khác. Tập trung các phim mới" · "1. 100 camp 2. ko cần chấm vì creative đội pass rồi" · "tạo migration 0442").
-- 1) Trần 100 camp mới / ngày (nhà, kể cả bản nhân) — apps/etp/cong.py đọc etp.cau_hinh.tran_camp_moi_ngay (đã đặt tay 07/11, ghi lại đây để kho mới có).
insert into etp.cau_hinh (khoa, gia_tri) values ('tran_camp_moi_ngay', '100'::jsonb) on conflict (khoa) do nothing;
-- 2) Hàng chờ lên camp etp.cho_len_v: creative ĐỘI (dang 'team', đã qua cổng chấm) của phim đội LÃI (đội tiêu ≥ $10, thu > chi, mọi ngày đã khép) mà Nhà chưa có camp
--    → lên THẲNG, mỗi creative một camp $1: không đi dòng phim mở rộng (0440), không kẹt mốc "chấm trong 3 ngày". Creative nhà giữ nguyên luật 0440.
--    Đợt 0 đo 07/11/2026: 40 phim đội lãi Nhà chưa chạy, 49 creative đội trên 24 phim; thứ tự: phim đội lãi (view) → creative đội → như cũ.
create or replace view etp.cho_len_v as
with doi as (select k.content_id, sum(s.chi) chi, sum(s.thu) thu from etp.camp_ngoai k join etp.so_ngay_ngoai s using (camp_id) where s.ngay < (now() at time zone 'utc')::date group by 1),
x as (
  select r.creative_id, r.content_id, coalesce(r.dang, '') dang, coalesce(r.lang, 'en') lang, coalesce(r.lo, '') lo, coalesce(r.tu, 0) tu, coalesce(r.den, 0) den, r.tu_choi,
    (select max(h.luc) from etp.cham h where h.creative_id = r.creative_id) cham_luc,
    exists (select 1 from etp.phim_nhan_v n where n.content_id = r.content_id and n.trang_thai = 'giu') nhan,
    exists (select 1 from etp.dong_phim d where d.content_id = r.content_id and d.trang_thai <> 'huy') co_dong,
    exists (select 1 from etp.phim_nhan_v n where n.content_id = r.content_id and n.trang_thai = 'giu' and n.nguoi_id not in (select nguoi_id from etp.tai_khoan where nha)) doi_nhan,
    exists (select 1 from etp.camp c where c.content_id = r.content_id) co_camp_phim,
    exists (select 1 from etp.camp c where c.content_id = r.content_id and c.trang_thai = 'ACTIVE') phim_chay,
    exists (select 1 from etp.camp c join etp.creative k on k.creative_id = c.creative_id where c.content_id = r.content_id and k.dang = r.dang) co_dang,
    (select (b.gia_tri->(r.creative_id::text)->>'luc')::timestamptz from etp.cau_hinh b where b.khoa = 'phim_moi_bo_qua') bq_luc,
    (select b.gia_tri->(r.creative_id::text)->>'loi' from etp.cau_hinh b where b.khoa = 'phim_moi_bo_qua') bq_loi,
    (r.dang = 'team' and exists (select 1 from doi where doi.content_id = r.content_id and doi.chi >= 10 and doi.thu > doi.chi)) team_lai
  from etp.creative r join etp.cham_cong g on g.creative_id = r.creative_id
  where g.duoc_len and r.content_id is not null and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id)
    and (r.dang <> 'team' or exists (select 1 from doi where doi.content_id = r.content_id and doi.chi >= 10 and doi.thu > doi.chi))   -- creative đội chỉ lên khi đội đang lãi trên phim đó
), y as (
  select x.*, case
    when tu_choi is not null then 'creative đã bị từ chối'
    when dl and not team_lai then 'phim đội lãi — Nhà mở qua dòng phim mở rộng (máy tự xếp mỗi 24 giờ, creative đúng CTA mới)'
    when (cham_luc is null or cham_luc <= now() - interval '3 days') and not team_lai then 'chấm đã quá 3 ngày — máy chỉ tự lên creative chấm trong 3 ngày gần nhất'
    when co_dong and dang <> 'ảnh tĩnh' and not team_lai then 'phim có dòng phim tự động — dòng phim lên camp'
    when doi_nhan then 'phim người trong đội đang nhận — lên ở tài khoản người nhận'
    when co_camp_phim and not (dang in ('kể chuyện', 'ảnh tĩnh') and phim_chay and not co_dang) then case
      when dang in ('kể chuyện', 'ảnh tĩnh') and co_dang then 'phim đã có camp ' || dang
      when dang in ('kể chuyện', 'ảnh tĩnh') then 'phim không còn camp nào đang chạy'
      else 'phim đã từng có camp — máy không tự lên lại phim đã bị tắt' end
    when bq_luc > now() - interval '24 hours' then 'lần trước lên lỗi: ' || coalesce(bq_loi, 'không rõ') || ' — máy thử lại sau ' || to_char((bq_luc + interval '24 hours') at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM')
  end ly_do from (select x.*, exists (select 1 from etp.phim_doi_lai d where d.content_id = x.content_id) dl,
    (select max(c.tao) from etp.camp c where c.content_id = x.content_id and c.ten like '% doi lai %') dl_luc from x) x),
-- PHIM ĐỘI LÃI (creative nhà) mỗi đợt MỘT creative (đợt = so_camp camp) — creative khác của phim chờ đợt sau; creative đội không theo đợt (mỗi creative một camp)
z as (select y.content_id, y.creative_id, y.dl, y.cham_luc, y.ly_do,
  row_number() over (partition by y.content_id, (y.dl and not y.team_lai and y.ly_do is null) order by y.cham_luc desc nulls last, y.creative_id) dl_thu from y),
y2 as (select y.creative_id, y.content_id, y.dang, y.lang, y.lo, y.tu, y.den, y.tu_choi, y.cham_luc, y.nhan, y.co_dong, y.doi_nhan, y.co_camp_phim, y.phim_chay, y.co_dang, y.bq_luc, y.bq_loi, y.team_lai,
  case when y.dl and not y.team_lai and y.ly_do is null and z.dl_thu > 1 then 'phim đội lãi — mỗi đợt một creative, creative này chờ đợt sau' else y.ly_do end ly_do
  from y join z using (creative_id))
-- thứ tự = thứ tự máy lấy (phim đội lãi · creative đội của phim đội lãi · phim đang NHẬN · kể chuyện / ảnh tĩnh làm theo lệnh · rồi chấm sớm trước)
select y.creative_id, y.content_id, y.dang, y.lang, y.lo, y.tu, y.den, y.tu_choi, y.cham_luc, y.nhan, y.co_dong, y.doi_nhan, y.co_camp_phim, y.phim_chay, y.co_dang, y.bq_luc, y.bq_loi, y.ly_do,
  case when ly_do is null then (row_number() over (partition by ly_do is null order by (exists (select 1 from etp.phim_doi_lai d where d.content_id = y.content_id)) desc, team_lai desc, nhan desc, (dang in ('kể chuyện', 'ảnh tĩnh')) desc, cham_luc))::int end hang,
  -- so_len = số camp máy lên MỘT LẦN cho creative này: creative đội → 1 · phim ROI cao cả đội (etp.phim_doi_lai) → len_doi_lai.so_camp · còn lại 1
  case when team_lai then 1 when exists (select 1 from etp.phim_doi_lai d where d.content_id = y.content_id)
    then coalesce((select (gia_tri->>'so_camp')::int from etp.cau_hinh where khoa = 'len_doi_lai'), 5) else 1 end so_len,
  y.team_lai   -- cột mới ĐỨNG CUỐI (create or replace view không cho đổi thứ tự cột cũ)
from y2 y;
