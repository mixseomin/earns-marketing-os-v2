-- CỔNG BỘ LỖ XÉT THEO TỪNG CAMP (anh 30/10/2026: "camp thắng phải thu được tối đa doanh thu … thì mới cân bằng được với camp lỗ"):
-- etp.bo_chan_mo(bộ) khoá MỌI nhân bản / bản thang của cả bộ khi camp đã tăng của bộ lỗ 3 ngày khép → 8 camp thắng bộ 2 (ROI 30–69%) bị khoá theo camp lỗ.
-- Bản này: camp gốc TỰ THẮNG (3 ngày đã khép: chi ≥ $3, ROI ≥ 30%) thì miễn khoá bộ; camp khác vẫn theo etp.bo_chan_mo như cũ.
-- Gọi từ nhan-ban.py (nhân bản / thang) và luat-ethopex.py (cổng mở bản thang).
CREATE OR REPLACE FUNCTION etp.bo_chan_mo_camp(b text, cid integer) RETURNS text LANGUAGE sql STABLE AS $$
  WITH x AS (SELECT sum(chi) chi, sum(thu) thu FROM etp.so_ngay
             WHERE camp_id = cid AND ngay BETWEEN (now() AT TIME ZONE 'utc')::date - 3 AND (now() AT TIME ZONE 'utc')::date - 1)
  SELECT CASE WHEN x.chi >= 3 AND (x.thu - x.chi) / x.chi >= 0.3 THEN NULL ELSE etp.bo_chan_mo(b) END FROM x
$$;
