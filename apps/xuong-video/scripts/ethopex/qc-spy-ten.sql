-- QC của ĐỐI THỦ cùng mô hình (landing tìm kiếm SEARCH.COM qua prel.<mien>/movie/<mã>) cho từng content Ethopex — nguồn HOOK + tiêu đề + mô tả + CTA của creative nhà
-- (luật anh 31/10/2026: hook lấy nguyên văn từ QC chạy lâu nhất trên spy; 23/11/2026 qc-spy-phim.sql chỉ ghép theo landing app gốc nên trượt hết QC đối thủ → chu-qc.py
-- rơi xuống câu chung, anh: "lỗi nội dung tự bịa"). Ghép: mã phim /movie/<mã> có ≥ 2 QC nhắc ĐÚNG tên phim → lấy MỌI QC cùng mã (kể cả QC không nhắc tên).
-- Chạy trên DB spy:  ssh root@167.233.241.16 '. /root/.secrets/spy.env; psql "$DATABASE_URL" -v ids=85055,49869 -tA -F"	" -f -' < qc-spy-ten.sql
-- Cột: id · library_id · page_id · dang_chay · (trống) · (trống) · nd · so_ngay_chay · cta — 7 cột đầu cùng khuôn qc-spy-phim.sql để chu-qc.py đọc chung.
WITH ec AS (  -- mẫu tên: tên Ethopex + tên gốc trong đường dẫn app (dramaboxdb /ep/<id>_<tên>/: "Sal de mi Bugatti" ↔ "¡Lárgate de mi Bugatti!" — byte %xx thành ký tự đại diện)
  SELECT id, m FROM (
    SELECT id, '%' || ten || '%' AS m FROM ethopex_content WHERE id = ANY (string_to_array(:'ids', ',')::int[]) AND length(ten) >= 8
    UNION SELECT id, '%' || replace(regexp_replace(substring(url from '/ep/\d+_([^/?#]+)'), '(%[0-9A-Fa-f]{2})+', '%', 'g'), '-', ' ') || '%'
    FROM ethopex_content WHERE id = ANY (string_to_array(:'ids', ',')::int[]) AND url ~ '/ep/\d+_'
  ) x WHERE length(replace(m, '%', '')) >= 8
),
ma AS (   -- đối thủ landing tìm kiếm: mã /movie/<mã> có ≥ 2 QC nhắc đúng tên → mọi QC cùng mã
  SELECT ec.id, substring(q.dich from '/movie/([^/?#]+)') AS ma
  FROM ec JOIN qc_meta q ON q.noi_dung ILIKE ec.m AND q.dich ~ '/movie/'
  GROUP BY 1, 2 HAVING count(*) >= 2
),
qc AS (
  SELECT ma.id, q.* FROM ma JOIN qc_meta q ON q.dich LIKE '%/movie/' || ma.ma || '/%'
  UNION SELECT ec.id, q.* FROM ec JOIN qc_meta q ON q.noi_dung ILIKE ec.m    -- QC nhắc thẳng tên (app gốc, đối thủ khác)
)
SELECT DISTINCT ON (q.id, q.library_id) q.id, q.library_id, q.page_id, (q.ngay_dung IS NULL) AS dang_chay, '' AS video_luc, '' AS video,
       regexp_replace(coalesce(q.noi_dung, ''), '\s+', ' ', 'g') AS nd,
       coalesce(coalesce(q.ngay_dung, q.lan_cuoi::date) - q.bat_dau, 0) AS so_ngay, coalesce(q.cta, '') AS cta
FROM qc q
ORDER BY q.id, q.library_id;
