-- etp.phim_nhan_td chậm 1,3–2,1 giây dù chỉ 30 dòng (anh 09/11/2026 "page camp giờ chậm quá"): CTE cr nối view etp.cham_cong
-- TRƯỚC khi chọn creative mới nhất mỗi phim → planner tính lại cả view cham_cong (3.389 dòng) một lần cho mỗi phim nhận (17 lần × 77 ms).
-- Chọn creative trước (cr0, materialized: tối đa 1 dòng / phim nhận), rồi mới tra cham_cong theo đúng creative đó bằng câu con vô hướng
-- (join / lateral đều bị planner dựng lại cả view; câu con có tham số thì lọc đẩy vào view: ~2,5 ms / creative) — cùng kết quả vì cả hai một dòng / creative.
-- Còn lại giữ nguyên bản 0413.
create or replace view etp.phim_nhan_td as
with n as (select v.*, p.loi, p.loi_luc from etp.phim_nhan_v v join etp.phim_nhan p using (id) where v.trang_thai in ('giu', 'da_len')),
s18 as (select key::bigint content_id, (value->>'ok')::boolean ok, value->>'ghi' ghi from xv_khoa_ngoai, jsonb_each(gia_tri) where ten = 'ethopex_soat_18' and key ~ '^\d+$'),
tv as (select distinct on (n.id) n.id, v.trang_thai, v.ghi, v.creative_id from n join etp.thu_vien v on v.content_id = n.content_id and v.dang = 'kể chuyện' and v.tao >= n.nhan_luc
         order by n.id, v.cap_nhat desc nulls last, v.id desc),
cr0 as materialized (select distinct on (n.id) n.id, r.creative_id
         from n join etp.creative r on r.content_id = n.content_id and r.dang = 'kể chuyện' and r.cap_nhat >= n.nhan_luc order by n.id, r.creative_id desc),
cr as (select cr0.id, cr0.creative_id,
           (select g.duoc_len from etp.cham_cong g where g.creative_id = cr0.creative_id) duoc_len,
           (select g.chan_boi from etp.cham_cong g where g.creative_id = cr0.creative_id) chan_boi,
           exists (select 1 from etp.cham h where h.creative_id = cr0.creative_id) da_cham
         from cr0),
dp as (select distinct on (content_id) content_id, id dong_id, trang_thai from etp.dong_phim where trang_thai <> 'huy' order by content_id, id desc)
select n.id, n.content_id, n.nguoi_id, n.nguoi, n.trang_thai,
  etp.tu_dong(n.nguoi_id) tu_dong,
  case when n.trang_thai = 'da_len' then 'da_len'
       when dp.dong_id is not null then 'dong'
       when n.loi is not null then 'loi'
       when not etp.tu_dong(n.nguoi_id) then 'tay'
       when s18.ok is null then 'cho_soat'
       when not s18.ok then 'loai_18'
       when cr.creative_id is not null and cr.duoc_len then 'cho_len'
       when cr.creative_id is not null and cr.da_cham and not coalesce(cr.duoc_len, false) then 'cham_chan'
       when cr.creative_id is not null then 'cho_cham'
       when tv.trang_thai = 'dang_sinh' then 'dang_sinh'
       when tv.trang_thai in ('loai', 'loi_may') then 'loi_sinh'
       when tv.trang_thai = 'san_sang' then 'cho_creative'
       else 'cho_sinh' end buoc,
  case when n.trang_thai = 'da_len' then 'đã lên camp' || coalesce(' ' || to_char(n.len_luc at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'), '')
       when dp.dong_id is not null then 'dòng phim tự động #' || dp.dong_id || ' (' || dp.trang_thai || ') — xem tab Dòng phim'
       when n.loi is not null then n.loi
       when not etp.tu_dong(n.nguoi_id) then 'chế độ tay — người nhận tự lên camp'
       when s18.ok is null then 'chờ soát 18+ (AI)'
       when not s18.ok then 'loại 18+: ' || coalesce(s18.ghi, '')
       when cr.creative_id is not null and cr.duoc_len then 'creative #' || cr.creative_id || ' chấm sạch — chờ lên camp'
       when cr.creative_id is not null and cr.da_cham then 'creative #' || cr.creative_id || ' bị chấm chặn: ' || coalesce(cr.chan_boi, '?')
       when cr.creative_id is not null then 'creative #' || cr.creative_id || ' chờ chấm'
       when tv.trang_thai = 'dang_sinh' then 'máy sinh đang làm: ' || coalesce(tv.ghi, '')
       when tv.trang_thai in ('loai', 'loi_may') then 'máy sinh lỗi: ' || coalesce(tv.ghi, '')
       when tv.trang_thai = 'san_sang' then 'video xong — chờ lên creative'
       else 'soát 18+ đạt — chờ máy sinh kể chuyện (đầu hàng đợi)' end ghi,
  n.het_luc, n.loi_luc
from n left join s18 using (content_id) left join tv using (id) left join cr using (id) left join dp using (content_id);
