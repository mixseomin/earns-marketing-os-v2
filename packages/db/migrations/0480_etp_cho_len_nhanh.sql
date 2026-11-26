-- KHO CHỜ LÊN NHANH (anh 26/11/2026: trang etp2 ?t=camp "đang bị comment là nặng").
-- Gốc: count(*) trên view mất 3,5 giây cho 4.406 dòng. Có 2 chỗ bị tính lại cho từng dòng:
--   sổ cấm xv_khoa_ngoai 'ethopex_phim_cam' (jsonb lớn) được đọc + giải nén 2 lần mỗi dòng → ~1,45 giây;
--   view etp.phim_doi_lai (gộp số theo phim) được tính lại 3 lần mỗi dòng → ~1 giây.
-- Sửa: tính MỘT lần trong CTE materialized (cam_so / cam_hong / cam / dl_ds), luật giữ nguyên:
--   sổ hỏng (không phải object) → mọi phim cấm; còn lại phim cấm = có khoá content_id trong sổ.
-- Thân view chép nguyên 0448, chỉ đổi các chỗ trên. Cột + thứ tự cột giữ nguyên.
create or replace view etp.cho_len_v as
with doi as (select k.content_id, sum(s.chi) chi, sum(s.thu) thu from etp.camp_ngoai k join etp.so_ngay_ngoai s using (camp_id) where s.ngay < (now() at time zone 'utc')::date group by 1),
cam_so as materialized (select case when jsonb_typeof(k.gia_tri) = 'object' then k.gia_tri end so from xv_khoa_ngoai k where k.ten = 'ethopex_phim_cam'),
cam_hong as materialized (select exists (select 1 from cam_so where so is null) hong),
cam as materialized (select jsonb_object_keys(so) content_id from cam_so where so is not null),
dl_ds as materialized (select distinct d.content_id from etp.phim_doi_lai d),
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
    (r.dang = 'team' and exists (select 1 from doi where doi.content_id = r.content_id and doi.chi >= 10 and doi.thu > doi.chi)) team_lai,
    ((select hong from cam_hong) or exists (select 1 from cam where cam.content_id = r.content_id::text)) phim_cam
  from etp.creative r join etp.cham_cong g on g.creative_id = r.creative_id
  where g.duoc_len and r.content_id is not null and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id)
    and (r.dang <> 'team' or exists (select 1 from doi where doi.content_id = r.content_id and doi.chi >= 10 and doi.thu > doi.chi))   -- creative đội chỉ lên khi đội đang lãi trên phim đó
), y as (
  select x.*, case
    when phim_cam then 'phim trong sổ cấm (ethopex_phim_cam) — không lên camp / creative dưới mọi hình thức'
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
  end ly_do from (select x.*, exists (select 1 from dl_ds d where d.content_id = x.content_id) dl,
    (select max(c.tao) from etp.camp c where c.content_id = x.content_id and c.ten like '% doi lai %') dl_luc from x) x),
-- PHIM ĐỘI LÃI (creative nhà) mỗi đợt MỘT creative (đợt = so_camp camp) — creative khác của phim chờ đợt sau; creative đội không theo đợt (mỗi creative một camp)
z as (select y.content_id, y.creative_id, y.dl, y.cham_luc, y.ly_do,
  row_number() over (partition by y.content_id, (y.dl and not y.team_lai and y.ly_do is null) order by y.cham_luc desc nulls last, y.creative_id) dl_thu from y),
y2 as (select y.creative_id, y.content_id, y.dang, y.lang, y.lo, y.tu, y.den, y.tu_choi, y.cham_luc, y.nhan, y.co_dong, y.doi_nhan, y.co_camp_phim, y.phim_chay, y.co_dang, y.bq_luc, y.bq_loi, y.team_lai,
  case when y.dl and not y.team_lai and y.ly_do is null and z.dl_thu > 1 then 'phim đội lãi — mỗi đợt một creative, creative này chờ đợt sau' else y.ly_do end ly_do
  from y join z using (creative_id))
-- thứ tự = thứ tự máy lấy (phim đội lãi · creative đội của phim đội lãi · phim đang NHẬN · kể chuyện / ảnh tĩnh làm theo lệnh · rồi chấm sớm trước)
select y.creative_id, y.content_id, y.dang, y.lang, y.lo, y.tu, y.den, y.tu_choi, y.cham_luc, y.nhan, y.co_dong, y.doi_nhan, y.co_camp_phim, y.phim_chay, y.co_dang, y.bq_luc, y.bq_loi, y.ly_do,
  case when ly_do is null then (row_number() over (partition by ly_do is null order by (exists (select 1 from dl_ds d where d.content_id = y.content_id)) desc, team_lai desc, nhan desc, (dang in ('kể chuyện', 'ảnh tĩnh')) desc, cham_luc))::int end hang,
  -- so_len = số camp máy lên MỘT LẦN cho creative này: creative đội → 1 · phim ROI cao cả đội (etp.phim_doi_lai) → len_doi_lai.so_camp · còn lại 1
  case when team_lai then 1 when exists (select 1 from dl_ds d where d.content_id = y.content_id)
    then coalesce((select (gia_tri->>'so_camp')::int from etp.cau_hinh where khoa = 'len_doi_lai'), 5) else 1 end so_len,
  y.team_lai   -- cột mới ĐỨNG CUỐI (create or replace view không cho đổi thứ tự cột cũ)
from y2 y;

-- CỔNG CHẤM etp.cham_cong (cùng lượt): cột giu là subquery vào view etp.cho_anh_duyet_cr (DISTINCT ON + sort) — CTE d không materialized nên
-- giu bị tính lại 3 lần mỗi dòng (duoc_len / chan_boi / cho_duyet) → câu chấm của trang mất ~1,1 giây cho 8.271 dòng.
-- Sửa: LEFT JOIN một lần (view trả tối đa 1 dòng / creative). Thân view chép nguyên 0464, chỉ đổi cột giu. Cột + thứ tự cột giữ nguyên.
create or replace view etp.cham_cong as
 WITH d AS (
         SELECT c.creative_id,
            ( SELECT string_agg((e.k || ' '::text) || e.v, ', '::text ORDER BY (e.v::numeric)) AS string_agg
                   FROM jsonb_each_text(c.diem) e(k, v)
                  WHERE (e.k ~~ 'meta.%'::text OR e.k ~~ 'afs.%'::text) AND e.v::numeric <= 4::numeric AND NOT (EXISTS ( SELECT 1
                           FROM etp.tieu_chi_mien m
                          WHERE m.dang = r.dang AND m.k = e.k))) AS le4,
            ( SELECT string_agg((e.k || ' '::text) || e.v, ', '::text) AS string_agg
                   FROM jsonb_each_text(c.diem) e(k, v)
                  WHERE (e.k ~~ 'meta.%'::text OR e.k ~~ 'afs.%'::text) AND e.v::numeric = 5::numeric AND NOT (EXISTS ( SELECT 1
                           FROM etp.tieu_chi_mien m
                          WHERE m.dang = r.dang AND m.k = e.k))) AS bang5,
            u.ok AS duyet,
            CASE WHEN h.creative_id IS NOT NULL THEN 'chờ anh duyệt'::text ||
                        CASE
                            WHEN h.ghi <> ''::text THEN (' ('::text || h.ghi) || ')'::text
                            ELSE ''::text
                        END
            END AS giu,
            COALESCE('đã loại: '::text || r.tu_choi,
              ( SELECT 'lời đọc mở bằng Free / gratis'::text FROM etp.diem_cham dc
                 WHERE dc.creative_id = c.creative_id AND (dc.cham -> 'voice' ->> 'cau') ~* '^\s*(\[[^]]*\]\s*)*(for\s+free|free|gratis)\M' LIMIT 1)) AS loai
           FROM etp.cham c
             LEFT JOIN etp.cham_duyet u USING (creative_id)
             LEFT JOIN etp.creative r ON r.creative_id = c.creative_id
             LEFT JOIN etp.cho_anh_duyet_cr h ON h.creative_id = c.creative_id   -- view DISTINCT ON creative_id → tối đa 1 dòng, không nhân dòng
        )
 SELECT creative_id,
    ((le4 IS NULL AND duyet IS DISTINCT FROM false OR duyet IS TRUE) AND NOT (giu IS NOT NULL AND duyet IS NULL)) AND loai IS NULL AS duoc_len,
        CASE
            WHEN loai IS NOT NULL THEN loai
            WHEN duyet IS TRUE THEN NULL::text
            WHEN giu IS NOT NULL AND duyet IS NULL THEN giu
            ELSE COALESCE(le4,
            CASE
                WHEN duyet IS FALSE THEN 'người duyệt loại'::text
                ELSE NULL::text
            END)
        END AS chan_boi,
    le4 IS NOT NULL AND duyet IS NOT TRUE OR duyet IS FALSE AS tat,
        CASE
            WHEN giu IS NOT NULL AND duyet IS NULL THEN giu
            ELSE NULL::text
        END AS cho_duyet
   FROM d;
