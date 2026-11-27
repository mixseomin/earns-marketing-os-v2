-- KHO HOOK THẬT cho câu đọc (anh 27/11/2026 "Nội dung câu đọc phải là hook giữ chân"): câu mở QC phim ngắn của app gốc (netshort / dramabox / reelshort) trên spy,
-- chạy lâu nhất trước, đúng tiếng (:lang = en | es). anh-tinh.hook_phim cho AI chọn MỘT câu khớp cốt truyện phim rồi sửa nhẹ — không tự nghĩ hook (luật 31/10/2026).
-- Chạy trên DB spy:  ssh root@167.233.241.16 '. /root/.secrets/spy.env; psql "$DATABASE_URL" -v lang=en -tA -F"	" -f -' < qc-spy-hook.sql
WITH q AS (
  SELECT library_id, page_ten, coalesce(ngay_dung, current_date) - bat_dau AS so_ngay,
         regexp_replace(regexp_replace(noi_dung, '\s+', ' ', 'g'), '^.*FB\.[A-Z]+\.COM\s+', '') AS nd
  FROM qc_meta
  WHERE (coalesce(dich, '') || coalesce(dich_cuoi, '')) ~* '(netshort|dramabox|reelshort)' AND noi_dung IS NOT NULL AND bat_dau IS NOT NULL
), c AS (
  SELECT library_id, page_ten, so_ngay, substring(nd FROM '^(.{40,220}?[.!?])(\s|$)') AS cau FROM q
  WHERE CASE WHEN :'lang' = 'es' THEN nd ~* '\m(que|ella|él|ellos|su|una|pero|nadie|todos|cuando|esposa|hijo)\M' AND nd !~* '\m(você|não|ele|uma|seu|filho|della|delle|il|non|sua|et|elle|mari|une|les|est)\M'
             ELSE nd ~ '^[ -~’“”—–]+$' AND nd ~* '\m(the|she|he|they|her|his|everyone|nobody)\M' END
)
SELECT * FROM (SELECT DISTINCT ON (lower(cau)) library_id, page_ten, so_ngay, cau FROM c
  WHERE cau IS NOT NULL AND cau !~* '(watch|click|download|app|episode|free|mira|gratis|descarga|haz clic|ver m[aá]s|https?:|\.com)'
  ORDER BY lower(cau), so_ngay DESC) d
ORDER BY so_ngay DESC LIMIT 80;
