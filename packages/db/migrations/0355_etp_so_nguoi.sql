-- SỐ THEO NGƯỜI (anh 28/10/2026: "sửa report trên tele theo hiện trạng nhiều tk người quản lý mới"): một nguồn cho mọi báo cáo theo người dùng Ethopex —
-- nhà = 3 tài khoản bộ 1/2/3 (etp.so_ngay), người khác = tài khoản htuan82 được xem (etp.so_ngay_ngoai × camp_ngoai × tai_khoan). Ngày = ngày Ethopex (UTC, 07h–07h VN).
create or replace view etp.so_nguoi as
  with nha as (select max(nguoi) ten, max(nguoi_id) id from etp.tai_khoan where nha)
  select (select ten from nha) nguoi, (select id from nha) nguoi_id, true nha, s.ngay, sum(s.chi) chi, sum(s.thu) thu, count(*) filter (where s.chi > 0) camp
    from etp.so_ngay s group by s.ngay
  union all
  select t.nguoi, t.nguoi_id, false, x.ngay, sum(x.chi), sum(x.thu), count(*) filter (where x.chi > 0)
    from etp.so_ngay_ngoai x join etp.camp_ngoai c using (camp_id) join etp.tai_khoan t on t.ad_account_id = c.ad_account_id group by t.nguoi, t.nguoi_id, x.ngay;
