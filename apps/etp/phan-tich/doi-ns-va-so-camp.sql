-- bộ 1, 3 ngày trọn gần nhất (D-3..D-1, ngày Ethopex), camp có chi >= $3
with s as (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay where ngay between current_date - 3 and current_date - 1 group by 1),
c as (select c.camp_id, c.content_id, s.chi, s.thu from etp.camp c join s using (camp_id) where c.bo = '1' and s.chi >= 3),
d as (select camp_id, count(distinct date_trunc('minute', luc)) n from etp.nhat_ky where viec in ('tang','giam') and ok and luc >= (current_date - 3)::timestamptz and luc < current_date::timestamptz group by 1),
p as (select content_id, count(*) so from etp.camp where bo = '1' and trang_thai = 'ACTIVE' group by 1)
select 'doi_ns ' || case when coalesce(d.n,0) = 0 then '0 lần' when d.n <= 2 then '1-2 lần' else '>=3 lần' end nhom, count(*) camp, round(sum(c.chi),0) chi, round(100*(sum(c.thu)-sum(c.chi))/sum(c.chi)) roi
from c left join d using (camp_id) group by 1
union all
select 'camp/phim ' || case when coalesce(p.so,0) <= 3 then '<=3' when p.so <= 8 then '4-8' else '>=9' end, count(*), round(sum(c.chi),0), round(100*(sum(c.thu)-sum(c.chi))/sum(c.chi))
from c left join p using (content_id) group by 1 order by 1;
