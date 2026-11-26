-- SỐ LẦN DÙNG CREATIVE = số camp FB THẬT SỰ đã chạy (anh 26/11/2026: "là số lần được active camp thực để fb nhìn thấy mới tính").
-- 0479 đếm mọi camp mang creative (cả camp tạo ra rồi bị dừng lịch, chưa tiêu đồng nào → 113306 ra 7 lần). Nay chỉ đếm camp có chi > 0 ở etp.so_ngay_ca
-- (bảng số theo camp duy nhất; số hiển thị chỉ có theo phim). Cột giữ nguyên: creative_id, goc, luot, lan_dung — etp2 đọc không đổi.
create or replace view etp.cr_lan_dung as
with dd as (select r.creative_id, coalesce(l.cr_goc, r.creative_id) goc from etp.creative r left join etp.luot2 l on l.cr_moi = r.creative_id),
n as (select dd.goc, count(*)::int n from etp.cr_co_camp k join dd using (creative_id)
      where exists (select 1 from etp.so_ngay_ca s where s.camp_id = k.camp_id and s.chi > 0) group by 1)
select dd.creative_id, dd.goc, case when dd.goc <> dd.creative_id then 2 else 1 end luot, coalesce(n.n, 0) lan_dung from dd left join n using (goc);
