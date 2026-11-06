-- CAMP CƠ HỘI — MỘT định nghĩa cho mọi máy (anh 06/11/2026: "phim đã tìm ra camp có cơ hội thì ko đc set Cất phim đi nữa. Mục tiêu khi rải camp
-- để test là để tìm cái này. Khi thấy thì phải tập trung scale từ nó chứ ko cất" — phim 172344 Too Much Woman? có #81655 chi $1,60 → thu $2,80 (ROI +75%)
-- vẫn "Sắp cất" vì luật cất chỉ tính camp lãi khi chi ≥ $3).
-- Camp nhà, CHỈ ngày Ethopex đã khép (như cat_phim): chi ≥ $1 (cùng mốc "camp thử có chi" của cat_phim) mà ROI ≥ 50% (= ROI_TANG luật tăng bậc —
-- camp máy sẽ scale), hoặc chi ≥ $3 và lãi (luật "camp nhà lãi" cũ). Đọc: apps/etp/cat_phim.py (không cất, mở lại) · anh-tinh.py (ưu tiên làm creative).
create or replace view etp.camp_co_hoi as
select c.content_id, c.camp_id, round(sum(n.chi), 2) chi, round(sum(n.thu), 2) thu, round((sum(n.thu) - sum(n.chi)) / sum(n.chi) * 100) roi
from etp.camp c join etp.so_ngay n on n.camp_id = c.camp_id and n.ngay < (now() at time zone 'utc')::date
where coalesce(c.content_id, 0) > 0
group by 1, 2
having (sum(n.chi) >= 1 and sum(n.thu) >= 1.5 * sum(n.chi)) or (sum(n.chi) >= 3 and sum(n.thu) > sum(n.chi));
