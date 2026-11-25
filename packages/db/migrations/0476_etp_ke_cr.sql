-- KẾ CAMP CỦA TỪNG CREATIVE — MỘT nguồn cho mọi đường lên camp (anh 25/11/2026 "Các chỉ số ROAS phải dàn đủ như tao bảo" · "cái nào cũng roas 1 à"):
-- creative của KHỐI (etp.khoi.mau → etp.mau_dung của phim trong khối) nhận ★ ROAS theo thứ tự trong phim: muc[1], muc[2], … (vòng lại khi nhiều creative hơn mức),
-- khuôn camp = khoi.khuon theo tiếng (Kiên 109046 / 109047 · marcusbeilby.com); creative bị loại không chiếm mức. Anh sửa tay mức ROAS ở etp2 (len_cr_roas mục "tu") thắng mức khối.
-- Ngoài khối: sổ len_cr_roas (lệnh tay 22/11 — chờ anh ▶ Lên). Không có dòng = ★ ROAS mặc định hoi_cho + KHUON_CR.
-- Người đọc: apps/etp/lenh_cho.py · apps/etp/dong_phim.py b_camp_khoi · apps/etp2 lenhNb / lenCampCr / dsChoDuyet / hangCr — một creative một camp.
create or replace view etp.ke_cr as
with s as (
  select e.k::int creative_id, (e.v ->> 'roas')::numeric roas, (e.v ->> 'ns')::numeric::int ns, coalesce(e.v ->> 'tu', '') = 'true' tu
  from etp.cau_hinh c, jsonb_each(c.gia_tri) e(k, v) where c.khoa = 'len_cr_roas' and e.k ~ '^\d+$'
), k as (
  select distinct k.id khoi_id, k.muc, k.ns, k.khuon, m.content_id, unnest(m.creative_ids) creative_id
  from etp.khoi k join etp.dong_phim d on d.khoi_id = k.id join etp.mau_dung m on m.mau = k.mau and m.content_id = d.content_id
  where k.huy_luc is null and k.trang_thai <> 'huy' and coalesce(cardinality(k.muc), 0) > 0
), x as (
  select k.*, case when r.lang = 'es' then 'es' else 'en' end lang,
    row_number() over (partition by k.khoi_id, k.content_id order by k.creative_id) - 1 i
  from k join etp.creative r using (creative_id)
  where not exists (select 1 from etp.cham_duyet u where u.creative_id = k.creative_id and not u.ok)
)
select x.creative_id, case when s.tu then s.roas else x.muc[1 + (x.i % cardinality(x.muc))::int] end roas, case when s.tu then s.ns else x.ns::int end ns,
  (x.khuon ->> x.lang)::int khuon, ('khối #' || x.khoi_id || case when s.tu then ' · anh sửa tay' else '' end) nguon, x.khoi_id, x.content_id, (x.i + 1)::int thu_tu
from x left join s using (creative_id)
union all
select s.creative_id, s.roas, s.ns, null::int, case when s.tu then 'anh sửa tay' else 'sổ len_cr_roas' end, null::int, null::int, null::int
from s where not exists (select 1 from x where x.creative_id = s.creative_id);
