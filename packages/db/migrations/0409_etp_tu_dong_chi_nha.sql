-- KHÔNG TỰ ĐỘNG NGOÀI TÀI KHOẢN NHÀ (anh 02/11/2026: "ko làm gì tự động ngoài tk Nhà" — sau khi 28 camp ROAS máy lên ở tk Sơn lỗ −26% trong ngày).
-- MỘT định nghĩa "máy được tự làm cho người này": etp.tu_dong(nguoi_id) = người có tài khoản nhà, HOẶC (công tắc tu_dong_ngoai_nha bật VÀ người đó chọn Tự động).
-- Công tắc mặc định TẮT → luật tự động đội (cty worker/etp-tu-dong.mjs), nhận phim Đội (view dưới → worker ethopex.mjs / máy sinh / soát 18+) và nút chọn Tự động
-- trên etp.on.tc đều đọc hàm này. Bật lại = update etp.cau_hinh set gia_tri = 'true' where khoa = 'tu_dong_ngoai_nha' (chỉ khi anh bảo).
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('tu_dong_ngoai_nha', 'false'::jsonb, 'máy tự làm (luật đội, nhận phim Đội) ở tài khoản ngoài Nhà — false = chỉ Nhà', 'anh (chat 02/11/2026: ko làm gì tự động ngoài tk Nhà)')
  on conflict (khoa) do update set gia_tri = excluded.gia_tri, ghi = excluded.ghi, ai = excluded.ai;

create or replace function etp.tu_dong(ng int) returns boolean language sql stable as $$
  select ng in (select nguoi_id from etp.tai_khoan where nha)
      or (coalesce((select gia_tri from etp.cau_hinh where khoa = 'tu_dong_ngoai_nha'), 'false'::jsonb) = 'true'::jsonb
          and exists (select 1 from etp.che_do_luat c where c.nguoi_id = ng and c.che_do = 'tu_dong'))
$$;

create or replace view etp.phim_nhan_td as
with n as (select v.*, p.loi, p.loi_luc from etp.phim_nhan_v v join etp.phim_nhan p using (id) where v.trang_thai in ('giu', 'da_len')),   -- loi đọc từ bảng gốc (phim_nhan_v cố định cột lúc tạo)
s18 as (select key::bigint content_id, (value->>'ok')::boolean ok, value->>'ghi' ghi from xv_khoa_ngoai, jsonb_each(gia_tri) where ten = 'ethopex_soat_18' and key ~ '^\d+$'),
-- chỉ bản thư viện / creative tạo SAU lúc nhận (phim có thể đã có bản kể chuyện cũ)
tv as (select distinct on (n.id) n.id, v.trang_thai, v.ghi, v.creative_id from n join etp.thu_vien v on v.content_id = n.content_id and v.dang = 'kể chuyện' and v.tao >= n.nhan_luc
         order by n.id, v.cap_nhat desc nulls last, v.id desc),
cr as (select distinct on (n.id) n.id, r.creative_id, g.duoc_len, g.chan_boi, (h.creative_id is not null) da_cham
         from n join etp.creative r on r.content_id = n.content_id and r.dang = 'kể chuyện' and r.cap_nhat >= n.nhan_luc
         left join etp.cham_cong g using (creative_id) left join etp.cham h using (creative_id) order by n.id, r.creative_id desc)
select n.id, n.content_id, n.nguoi_id, n.nguoi, n.trang_thai,
  etp.tu_dong(n.nguoi_id) tu_dong,
  case when n.trang_thai = 'da_len' then 'da_len'
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
from n left join s18 using (content_id) left join tv using (id) left join cr using (id);
