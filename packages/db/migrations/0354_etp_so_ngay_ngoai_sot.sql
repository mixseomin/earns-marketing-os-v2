-- SÓT TỪ 0351 (28/10/2026): số theo ngày của camp tài khoản NGOÀI mà lúc chuyển chưa có dòng trong etp.camp (camp nằm trang 2 của danh sách Ethopex — script cũ chỉ đọc
-- một trang) vẫn nằm trong etp.so_ngay → báo cáo nhà 27/10 cộng thừa $798 (106 dòng). Chuyển nốt mọi dòng của camp ngoài sang so_ngay_ngoai (không xoá dữ liệu).
insert into etp.so_ngay_ngoai (camp_id, ngay, chi, thu)
  select s.camp_id, s.ngay, s.chi, s.thu from etp.so_ngay s where s.camp_id in (select camp_id from etp.camp_ngoai) and s.camp_id not in (select camp_id from etp.camp)
  on conflict (camp_id, ngay) do update set chi = greatest(so_ngay_ngoai.chi, excluded.chi), thu = greatest(so_ngay_ngoai.thu, excluded.thu);
delete from etp.so_ngay s where s.camp_id in (select camp_id from etp.camp_ngoai) and s.camp_id not in (select camp_id from etp.camp);
