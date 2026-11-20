-- KHO BÀI VIẾT (anh 20/11/2026 "Việc lên camp có dựa vào danh sách bài viết hiệu suất cao. Nhưng trong etp2 chưa có chỗ quản lý danh sách bài viết này
-- để từ đó lên camp mới. Hãy xây nó").
--  · etp.camp.bai_viet = mã bài của ad (effective_object_story_id "<fb page>_<post>"), apps/etp/dong-bo.py ghi mỗi lần đọc chi tiết camp + lấp ngược theo lô
--  · etp.bai_ds = danh sách lên camp do người chọn: ghim (ưu tiên khi hồi chợ / lên ROAS) · loai (bỏ qua, kèm lý do) · ghi chú
--  · etp.bai_viet_v = một dòng một bài: phim, Page, tài khoản, số camp, chi · thu · ROI theo kỳ, mốc luật đạt, dùng lại được không
-- Ngưỡng mốc đọc từ sổ luật chung (apps/web/src/lib/etp-bang-luat.json) — dong-bo.py chép nguyên tệp vào etp.bang_luat mỗi lượt
-- (bảng riêng, không vào etp.cau_hinh vì màn Thiết lập liệt kê mọi khoá ở đó); view không tự đặt ngưỡng nào (thiếu bản chép → cột mốc để trống).

create table if not exists etp.bang_luat (
  id      int primary key default 1 check (id = 1),
  gia_tri jsonb not null,
  luc     timestamptz not null default now()
);

alter table etp.camp add column if not exists bai_viet text, add column if not exists bai_doc timestamptz;
create index if not exists camp_bai_viet_idx on etp.camp (bai_viet) where bai_viet is not null;

create table if not exists etp.bai_ds (
  bai_viet   text primary key,
  trang_thai text check (trang_thai in ('ghim', 'loai')),
  ly_do      text,
  ghi_chu    text,
  ai         text,
  luc        timestamptz not null default now()
);

create or replace view etp.bai_viet_v as
with l as (select gia_tri g from etp.bang_luat where id = 1),
d as (select max(ngay) d0 from etp.so_ngay),
w as (select (l.g->'hoi_cho'->>'moc_sut')::date sut, (l.g->'hoi_cho'->>'truoc_ngay')::int truoc from l),
s as (
  select n.camp_id,
    sum(n.chi) chi, sum(n.thu) thu,
    sum(n.chi) filter (where n.ngay > d.d0 - 30) chi30, sum(n.thu) filter (where n.ngay > d.d0 - 30) thu30,
    sum(n.chi) filter (where n.ngay > d.d0 - 7) chi7, sum(n.thu) filter (where n.ngay > d.d0 - 7) thu7,
    sum(n.chi) filter (where n.ngay > d.d0 - 3) chi3, sum(n.thu) filter (where n.ngay > d.d0 - 3) thu3,
    sum(n.chi) filter (where n.ngay between d.d0 - 3 and d.d0 - 1) chi3k, sum(n.thu) filter (where n.ngay between d.d0 - 3 and d.d0 - 1) thu3k,
    sum(n.chi) filter (where n.ngay = d.d0) chi_nay, sum(n.thu) filter (where n.ngay = d.d0) thu_nay,
    sum(n.chi) filter (where n.ngay >= w.sut - w.truoc and n.ngay < w.sut) chi_sut, sum(n.thu) filter (where n.ngay >= w.sut - w.truoc and n.ngay < w.sut) thu_sut,
    max(n.ngay) filter (where n.chi > 0) chay_cuoi
  from etp.so_ngay n cross join d left join w on true
  where n.camp_id in (select camp_id from etp.camp where bai_viet is not null)
  group by n.camp_id
),
c as (
  select c.*, coalesce(s.chi, 0) chi, coalesce(s.thu, 0) thu, coalesce(s.chi30, 0) chi30, coalesce(s.thu30, 0) thu30,
    coalesce(s.chi7, 0) chi7, coalesce(s.thu7, 0) thu7, coalesce(s.chi3, 0) chi3, coalesce(s.thu3, 0) thu3,
    coalesce(s.chi3k, 0) chi3k, coalesce(s.thu3k, 0) thu3k, coalesce(s.chi_nay, 0) chi_nay, coalesce(s.thu_nay, 0) thu_nay,
    coalesce(s.chi_sut, 0) chi_sut, coalesce(s.thu_sut, 0) thu_sut, s.chay_cuoi,
    row_number() over (partition by c.bai_viet order by c.tao nulls last, c.camp_id) thu_tu,
    row_number() over (partition by c.bai_viet order by c.tao desc nulls last, c.camp_id desc) moi_nhat
  from etp.camp c left join s using (camp_id)
  where c.bai_viet is not null
),
b as (
  select bai_viet,
    split_part(bai_viet, '_', 1) fb_page,
    max(camp_id) filter (where thu_tu = 1) camp_dau,
    max(ten) filter (where thu_tu = 1) camp_dau_ten,
    min(tao) tao_dau,
    max(bo) filter (where thu_tu = 1) bo,
    max(ad_account_id) filter (where thu_tu = 1) ad_account_id,
    array_agg(distinct bo) filter (where bo is not null) bo_ds,
    (array_agg(content_id order by thu_tu) filter (where coalesce(content_id, 0) <> 0))[1] content_id,
    (array_agg(creative_id order by thu_tu) filter (where coalesce(creative_id, 0) <> 0))[1] creative_id,
    count(*) so_camp,
    count(*) filter (where trang_thai = 'ACTIVE') so_bat,
    count(*) filter (where trang_thai is distinct from 'ACTIVE') so_tat,
    count(*) filter (where not la_roas) so_thuong,
    count(*) filter (where la_roas) so_roas,
    count(*) filter (where trang_thai = 'ACTIVE' and not la_roas) so_bat_thuong,
    count(*) filter (where trang_thai = 'ACTIVE' and la_roas) so_bat_roas,
    sum(chi) chi, sum(thu) thu, sum(chi30) chi30, sum(thu30) thu30, sum(chi7) chi7, sum(thu7) thu7, sum(chi3) chi3, sum(thu3) thu3,
    sum(chi3k) chi3k, sum(thu3k) thu3k, sum(chi_nay) chi_nay, sum(thu_nay) thu_nay, sum(chi_sut) chi_sut, sum(thu_sut) thu_sut,
    max(chay_cuoi) chay_cuoi,
    max(loi) filter (where moi_nhat = 1) loi_moi
  from c group by bai_viet
),
-- số camp ★ ROAS theo mức thầu của từng bài: {"1.1": 2, "1.3": 1}
rm as (
  select bai_viet, jsonb_object_agg(m, k) roas_muc
  from (select bai_viet, roas::text m, count(*) k from c where la_roas and roas is not null group by 1, 2) x group by 1
),
r as (
  select b.*,
    case when b.chi > 0 then round((b.thu - b.chi) / b.chi * 100, 1) end roi,
    case when b.chi30 > 0 then round((b.thu30 - b.chi30) / b.chi30 * 100, 1) end roi30,
    case when b.chi7 > 0 then round((b.thu7 - b.chi7) / b.chi7 * 100, 1) end roi7,
    case when b.chi3 > 0 then round((b.thu3 - b.chi3) / b.chi3 * 100, 1) end roi3,
    case when b.chi3k > 0 then round((b.thu3k - b.chi3k) / b.chi3k * 100, 1) end roi3k,
    case when b.chi_nay > 0 then round((b.thu_nay - b.chi_nay) / b.chi_nay * 100, 1) end roi_nay,
    case when b.chi_sut > 0 then round((b.thu_sut - b.chi_sut) / b.chi_sut * 100, 1) end roi_sut
  from b
)
select r.bai_viet, r.fb_page, tn.id page_id, tn.ten page_ten, tn.them->>'picture_url' page_anh,
  r.camp_dau, r.camp_dau_ten, r.tao_dau, r.bo, r.ad_account_id, r.bo_ds,
  r.content_id, p.ten phim, r.creative_id, coalesce(cr.lang, p.locale) ngon_ngu,
  r.so_camp, r.so_bat, r.so_tat, r.so_thuong, r.so_roas, r.so_bat_thuong, r.so_bat_roas, rm.roas_muc,
  round(r.chi, 2) chi, round(r.thu, 2) thu, round(r.thu - r.chi, 2) lai, r.roi,
  round(r.chi30, 2) chi30, r.roi30, round(r.chi7, 2) chi7, round(r.thu7, 2) thu7, r.roi7,
  round(r.chi3, 2) chi3, round(r.thu3, 2) thu3, r.roi3, r.roi3k,
  round(r.chi_nay, 2) chi_nay, round(r.thu_nay, 2) thu_nay, r.roi_nay,
  round(r.chi_sut, 2) chi_sut, round(r.thu_sut, 2) thu_sut, r.roi_sut, w.sut moc_sut,
  r.chay_cuoi,
  -- MỐC LUẬT (sổ luật chung): lên ROAS (chi 30 ngày ≥ roas_len.chi & ROI 3 ngày khép ≥ roas_len.roi) · nấc nhân bản (tổng bản đạt theo nhan_ban.nac)
  -- · gốc hồi chợ (trong khung [moc_sut − truoc_ngay, moc_sut): chi ≥ hoi_cho.goc.chi & ROI ≥ hoi_cho.goc.roi)
  (r.chi30 >= (l.g->'roas_len'->>'chi')::numeric and r.roi3k >= (l.g->'roas_len'->>'roi')::numeric) moc_roas_len,
  (select max((n->>2)::int) from jsonb_array_elements(l.g->'nhan_ban'->'nac') n
    where r.chi >= (n->>0)::numeric and r.roi >= (n->>1)::numeric) moc_nac,
  (r.chi_sut >= (l.g->'hoi_cho'->'goc'->>'chi')::numeric and r.roi_sut >= (l.g->'hoi_cho'->'goc'->>'roi')::numeric) moc_hoi_cho,
  -- DÙNG LẠI ĐƯỢC: Page còn dùng · bài không báo lỗi ở camp mới nhất · phim không cấm · creative không bị cổng chấm chặn · không bị loại khỏi danh sách
  nullif(concat_ws(' · ',
    case when tn.id is null then 'Page không còn trong kho tài nguyên'
         when tn.trang_thai is distinct from 'active' or (tn.them->>'available')::boolean is false then 'Page không dùng được'
         when (tn.them->>'ads_restricted')::boolean then 'Page bị hạn chế quảng cáo' end,
    case when r.loi_moi ~* '(post|story|bài viết)' then 'bài báo lỗi: ' || left(r.loi_moi, 120) end,
    case when pc.gia_tri ? r.content_id::text then 'phim cấm' || coalesce(': ' || (pc.gia_tri->r.content_id::text->>'ly_do'), '') end,
    case when cc.duoc_len is false then 'creative bị chặn: ' || coalesce(cc.chan_boi, 'cổng chấm') end,
    case when ds.trang_thai = 'loai' then 'đã loại khỏi danh sách' || coalesce(': ' || ds.ly_do, '') end), '') ly_do_khong,
  ds.trang_thai ds_trang_thai, ds.ly_do ds_ly_do, ds.ghi_chu ds_ghi_chu, ds.ai ds_ai, ds.luc ds_luc
from r
left join rm using (bai_viet)
left join l on true
left join w on true
left join etp.tai_nguyen tn on tn.loai = 'page' and tn.external_id = r.fb_page
left join etp.phim p on p.content_id = r.content_id
left join etp.creative cr on cr.creative_id = r.creative_id
left join etp.cham_cong cc on cc.creative_id = r.creative_id
left join (select gia_tri::jsonb gia_tri from xv_khoa_ngoai where ten = 'ethopex_phim_cam') pc on true
left join etp.bai_ds ds on ds.bai_viet = r.bai_viet;
