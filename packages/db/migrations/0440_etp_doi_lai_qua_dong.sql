-- PHIM ĐỘI LÃI ĐI DÒNG MỞ RỘNG (anh 06/11/2026 "phải mở thêm ở Nhà các camp kiểu này"): 0439 cho creative phim đội lãi lên thẳng qua hàng chờ này,
-- nhịp 10:28 lên 0 camp — creative có sẵn của 169100 / 172519 / 153695 đều dựng theo CTA cũ (nhan-ban chặn 'chưa đạt luật CTA mới').
-- Nay dong_phim.py mo_doi_lai() tự xếp dòng mở rộng CC (so_camp = len_doi_lai.so_camp) — đường dòng dùng lại creative đạt CTA, thiếu thì cắt mới, rồi lên camp.
-- Hàng chờ này không lên creative phim đội lãi nữa (một đường, khỏi lên đôi).
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
    when dl then 'phim đội lãi — Nhà mở qua dòng phim mở rộng (máy tự xếp mỗi 24 giờ, creative đúng CTA mới)'
    when cham_luc is null or cham_luc <= now() - interval '3 days' then 'chấm đã quá 3 ngày — máy chỉ tự lên creative chấm trong 3 ngày gần nhất'
    when co_dong and dang <> 'ảnh tĩnh' then 'phim có dòng phim tự động — dòng phim lên camp'
    when doi_nhan then 'phim người trong đội đang nhận — lên ở tài khoản người nhận'
    when co_camp_phim and not (dang in ('kể chuyện', 'ảnh tĩnh') and phim_chay and not co_dang) then case
      when dang in ('kể chuyện', 'ảnh tĩnh') and co_dang then 'phim đã có camp ' || dang
      when dang in ('kể chuyện', 'ảnh tĩnh') then 'phim không còn camp nào đang chạy'
      else 'phim đã từng có camp — máy không tự lên lại phim đã bị tắt' end
    when bq_luc > now() - interval '24 hours' then 'lần trước lên lỗi: ' || coalesce(bq_loi, 'không rõ') || ' — máy thử lại sau ' || to_char((bq_luc + interval '24 hours') at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM')
  end ly_do from (select x.*, exists (select 1 from etp.phim_doi_lai d where d.content_id = x.content_id) dl,
    (select max(c.tao) from etp.camp c where c.content_id = x.content_id and c.ten like '% doi lai %') dl_luc from x) x),
-- PHIM ĐỘI LÃI mỗi đợt MỘT creative (đợt = so_camp camp) — creative khác của phim chờ đợt sau
z as (select y.content_id, y.creative_id, y.dl, y.cham_luc, y.ly_do,
  row_number() over (partition by y.content_id, (y.dl and y.ly_do is null) order by y.cham_luc desc nulls last, y.creative_id) dl_thu from y),
y2 as (select y.creative_id, y.content_id, y.dang, y.lang, y.lo, y.tu, y.den, y.tu_choi, y.cham_luc, y.nhan, y.co_dong, y.doi_nhan, y.co_camp_phim, y.phim_chay, y.co_dang, y.bq_luc, y.bq_loi,
  case when y.dl and y.ly_do is null and z.dl_thu > 1 then 'phim đội lãi — mỗi đợt một creative, creative này chờ đợt sau' else y.ly_do end ly_do
  from y join z using (creative_id))
-- thứ tự = thứ tự máy lấy (phim đang NHẬN trước · kể chuyện / ảnh tĩnh làm theo lệnh · rồi chấm sớm trước)
select y.*, case when ly_do is null then (row_number() over (partition by ly_do is null order by (exists (select 1 from etp.phim_doi_lai d where d.content_id = y.content_id)) desc, nhan desc, (dang in ('kể chuyện', 'ảnh tĩnh')) desc, cham_luc))::int end hang,
  -- so_len = số camp máy lên MỘT LẦN cho creative này: phim ROI cao cả đội (etp.phim_doi_lai) → len_doi_lai.so_camp, còn lại 1
  case when exists (select 1 from etp.phim_doi_lai d where d.content_id = y.content_id)
    then coalesce((select (gia_tri->>'so_camp')::int from etp.cau_hinh where khoa = 'len_doi_lai'), 5) else 1 end so_len
from y2 y;
