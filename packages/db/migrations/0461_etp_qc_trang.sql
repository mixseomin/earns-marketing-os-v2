-- SỐ QUẢNG CÁO ADSENSE THEO CAMP / PHIM (anh 23/11/2026 "làm đi"): trước đây máy chỉ lấy Ad requests / Impressions / Fill / Impression RPM / Page views
-- ở mức CẢ CHỢ (apps/etp/gia_adsense.py → etp.cau_hinh rpm_ngay) → không tách được camp / phim lỗ vì TRANG PHIM kiếm ít hay vì FACEBOOK đắt.
--  · camp × ngày: dùng bảng phễu sẵn có etp.so_pheu (đã có hien / nhap / s_hien / s_nhap cho MỌI camp nhà + đội), thêm luot_xem + xin_qc —
--    apps/etp/dong-bo.py gộp cột vào lượt report phễu đang có (không thêm lượt gọi), lấp ngược 14 ngày một lần
--  · phim × giờ: etp.so_gio / so_gio_ngoai thêm luot_xem, xin_qc, qc_hien (gộp vào lượt report phim × giờ đang có)
--  · etp.qc_chi_so(): MỘT hàm tính chỉ số + nhãn chẩn đoán, ngưỡng đọc từ sổ luật chung (etp.bang_luat → mục qc_trang), không cứng trong mã
--  · etp.qc_camp_v (camp × ngày) · etp.qc_phim_v (phim × ngày × nhà / đội) — cùng gọi etp.qc_chi_so

alter table etp.so_pheu add column if not exists luot_xem int, add column if not exists xin_qc int;
comment on column etp.so_pheu.hien is 'AdSense — Impressions: số quảng cáo AdSense hiện trên trang phim (report cột impressions)';
comment on column etp.so_pheu.nhap is 'AdSense — Clicks: lượt bấm quảng cáo AdSense trên trang phim (report cột clicks)';
comment on column etp.so_pheu.s_hien is 'Facebook — S Impressions: lượt hiển thị quảng cáo Facebook (report cột supply_impressions)';
comment on column etp.so_pheu.s_nhap is 'Facebook — S Clicks: lượt bấm quảng cáo Facebook (report cột supply_clicks)';
comment on column etp.so_pheu.luot_xem is 'AdSense — Page views: lượt xem trang phim (report cột page_views)';
comment on column etp.so_pheu.xin_qc is 'AdSense — Ad requests: số lần trang phim xin quảng cáo AdSense (report cột ad_requests)';

alter table etp.so_gio add column if not exists luot_xem int not null default 0, add column if not exists xin_qc int not null default 0, add column if not exists qc_hien int not null default 0;
alter table etp.so_gio_ngoai add column if not exists luot_xem int not null default 0, add column if not exists xin_qc int not null default 0, add column if not exists qc_hien int not null default 0;
comment on column etp.so_gio.luot_xem is 'AdSense — Page views trang phim trong giờ';
comment on column etp.so_gio.xin_qc is 'AdSense — Ad requests trong giờ';
comment on column etp.so_gio.qc_hien is 'AdSense — Impressions (quảng cáo AdSense hiện) trong giờ';
comment on column etp.so_gio_ngoai.luot_xem is 'AdSense — Page views trang phim trong giờ (camp đội)';
comment on column etp.so_gio_ngoai.xin_qc is 'AdSense — Ad requests trong giờ (camp đội)';
comment on column etp.so_gio_ngoai.qc_hien is 'AdSense — Impressions (quảng cáo AdSense hiện) trong giờ (camp đội)';

-- chỉ số + nhãn: irpm = thu / qc_hien × 1000 · fill % = qc_hien / xin_qc · prpm = thu / luot_xem × 1000 · qc_xem = qc_hien / luot_xem · cpc / cpm Facebook
-- *_lech = % chênh so với chợ cùng ngày (cpc_lech so với trung vị CPC camp nhà cùng ngày). t = mục qc_trang của sổ luật (null → không gắn nhãn)
create or replace function etp.qc_chi_so(chi numeric, thu numeric, luot_xem numeric, xin_qc numeric, qc_hien numeric, fb_hien numeric, fb_bam numeric,
                                         cho_irpm numeric, cho_fill numeric, cpc_tv numeric, t jsonb)
returns table (roi numeric, irpm numeric, fill numeric, prpm numeric, qc_xem numeric, cpc numeric, cpm numeric,
               irpm_lech numeric, fill_lech numeric, cpc_lech numeric, nhan text[])
language sql stable as $f$
  with s as (
    select case when chi > 0 then round((thu - chi) / chi * 100, 1) end roi,
           case when qc_hien > 0 then round(thu / qc_hien * 1000, 2) end irpm,
           case when xin_qc > 0 then round(qc_hien / xin_qc * 100, 1) end fill,
           case when luot_xem > 0 then round(thu / luot_xem * 1000, 2) end prpm,
           case when luot_xem > 0 then round(qc_hien / luot_xem, 2) end qc_xem,
           case when fb_bam >= coalesce((t->>'fb_bam_min')::numeric, 1) and fb_bam > 0 then round(chi / fb_bam, 4) end cpc,
           case when fb_hien > 0 then round(chi / fb_hien * 1000, 2) end cpm)
  select s.roi, s.irpm, s.fill, s.prpm, s.qc_xem, s.cpc, s.cpm,
         case when cho_irpm > 0 then round((s.irpm / cho_irpm - 1) * 100) end,
         case when cho_fill > 0 then round((s.fill / cho_fill - 1) * 100) end,
         case when cpc_tv > 0 then round((s.cpc / cpc_tv - 1) * 100) end,
         case when t is null then '{}'::text[] else array_remove(array[
           case when hong then 'trang hỏng' end,
           case when not hong and qc_hien >= (t->>'yeu_hien')::numeric
                 and (s.irpm < cho_irpm * (1 - (t->>'yeu_kem')::numeric) or s.fill < cho_fill * (1 - (t->>'yeu_kem')::numeric)) then 'trang yếu' end,
           case when s.cpc > cpc_tv * (1 + (t->>'fb_dat')::numeric) then 'FB đắt' end], null) end
  from s, lateral (select t is not null and luot_xem >= (t->>'hong_xem')::numeric
                          and (coalesce(xin_qc, 0) = 0 or s.fill < (t->>'hong_fill')::numeric) hong) h
$f$;

create or replace view etp.qc_camp_v as
with l as (select gia_tri->'qc_trang' t from etp.bang_luat where id = 1),
cho as (select key::date ngay, (value->>'irpm')::numeric irpm, (value->>'fill')::numeric fill, (value->>'prpm')::numeric prpm
          from etp.cau_hinh, jsonb_each(gia_tri) where khoa = 'rpm_ngay' and key ~ '^\d{4}-\d{2}-\d{2}$'),
b as (
  select p.camp_id, p.ngay, c.camp_id is not null nha, coalesce(c.content_id, cn.content_id) content_id, coalesce(c.ten, cn.ten) ten,
         coalesce(case when c.camp_id is not null then sn.chi else sx.chi end, 0) chi, coalesce(case when c.camp_id is not null then sn.thu else sx.thu end, 0) thu,
         coalesce(p.luot_xem, 0) luot_xem, coalesce(p.xin_qc, 0) xin_qc, coalesce(p.hien, 0) qc_hien, coalesce(p.nhap, 0) bam_qc,
         coalesce(p.s_hien, 0) fb_hien, coalesce(p.s_nhap, 0) fb_bam
    from etp.so_pheu p
    left join etp.camp c on c.camp_id = p.camp_id
    left join etp.camp_ngoai cn on cn.camp_id = p.camp_id and c.camp_id is null
    left join etp.so_ngay sn on sn.camp_id = p.camp_id and sn.ngay = p.ngay
    left join etp.so_ngay_ngoai sx on sx.camp_id = p.camp_id and sx.ngay = p.ngay),
tv as (select ngay, percentile_cont(0.5) within group (order by chi / fb_bam)::numeric cpc_tv from b, l
        where nha and fb_bam > 0 and fb_bam >= coalesce((l.t->>'fb_bam_min')::numeric, 1) group by ngay)
select b.*, cho.irpm cho_irpm, cho.fill cho_fill, cho.prpm cho_prpm, round(tv.cpc_tv, 4) cpc_tv, k.*
  from b left join cho using (ngay) left join tv using (ngay) left join l on true
  cross join lateral etp.qc_chi_so(b.chi, b.thu, b.luot_xem, b.xin_qc, b.qc_hien, b.fb_hien, b.fb_bam, cho.irpm, cho.fill, tv.cpc_tv, l.t) k;

create or replace view etp.qc_phim_v as
with l as (select gia_tri->'qc_trang' t from etp.bang_luat where id = 1),
g as (
  select content_id, ngay, nha, count(*) so_camp, sum(chi) chi, sum(thu) thu, sum(luot_xem) luot_xem, sum(xin_qc) xin_qc, sum(qc_hien) qc_hien,
         sum(bam_qc) bam_qc, sum(fb_hien) fb_hien, sum(fb_bam) fb_bam, max(cho_irpm) cho_irpm, max(cho_fill) cho_fill, max(cho_prpm) cho_prpm, max(cpc_tv) cpc_tv
    from etp.qc_camp_v where content_id is not null group by content_id, ngay, nha)
select g.content_id, ph.ten phim, g.ngay, g.nha, g.so_camp, g.chi, g.thu, g.luot_xem, g.xin_qc, g.qc_hien, g.bam_qc, g.fb_hien, g.fb_bam,
       g.cho_irpm, g.cho_fill, g.cho_prpm, g.cpc_tv, k.*
  from g left join etp.phim ph on ph.content_id = g.content_id left join l on true
  cross join lateral etp.qc_chi_so(g.chi, g.thu, g.luot_xem, g.xin_qc, g.qc_hien, g.fb_hien, g.fb_bam, g.cho_irpm, g.cho_fill, g.cpc_tv, l.t) k;

comment on view etp.qc_camp_v is 'Số quảng cáo AdSense + Facebook theo camp × ngày, so với chợ cùng ngày; nhan = trang hỏng / trang yếu / FB đắt (ngưỡng: sổ luật qc_trang)';
comment on view etp.qc_phim_v is 'Số quảng cáo AdSense + Facebook theo phim × ngày (nha = camp nhà / đội), so với chợ cùng ngày; nhãn như etp.qc_camp_v';
