-- NGÂN SÁCH THEO NGÀY phải là mức CAO NHẤT trong ngày, không phải ảnh chụp cuối ngày (anh 26/10/2026: "sao ngân sách và số chi ko hợp lý?" —
-- 25/10 ngân sách $1,096 mà chi $1,912: máy giảm bậc nhiều lần trong ngày, vd #65487 $15→$10→…→$1 đã tiêu $12.81 nhưng sổ ghi $2).
-- ns_max = ngân sách cao nhất camp có trong ngày (dong-bo.py giữ greatest mỗi lượt) · bat = camp có lúc nào ACTIVE trong ngày.
alter table etp.so_ngay add column if not exists ns_max numeric;
alter table etp.so_ngay add column if not exists bat boolean not null default false;
-- điền bù ngày cũ: mức cao nhất trong số ảnh chụp cuối ngày + mọi mức trước/sau của lệnh tăng/giảm trong ngày đó (ngày Ethopex = ngày UTC)
update etp.so_ngay s set
  ns_max = greatest(s.ngan_sach, (select max(v) from (select nullif(regexp_replace(n.truoc, '[^0-9.]', '', 'g'), '')::numeric v from etp.nhat_ky n
                                   where n.camp_id = s.camp_id and n.viec in ('tang', 'giam') and (n.luc at time zone 'UTC')::date = s.ngay
                                   union all select nullif(regexp_replace(n.sau, '[^0-9.]', '', 'g'), '')::numeric from etp.nhat_ky n
                                   where n.camp_id = s.camp_id and n.viec in ('tang', 'giam') and (n.luc at time zone 'UTC')::date = s.ngay) x)),
  bat = (coalesce(s.trang_thai, '') = 'ACTIVE' or coalesce(s.chi, 0) > 0)
where s.ns_max is null;
