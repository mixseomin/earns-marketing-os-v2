-- QC thật của app gốc cho từng content Ethopex (cùng cách ghép của view ethopex_uu_tien trên spy.on.tc), kèm video + chữ.
-- Chạy trên DB spy:  ssh root@167.233.241.16 '. /root/.secrets/spy.env; psql "$DATABASE_URL" -v ids=94344,70634 -tA -F"	" -f -' < qc-spy-phim.sql
WITH qc AS (
  SELECT q.library_id, q.page_id, q.ngay_dung, q.video_hd, q.video_sd, q.video_luc, regexp_replace(coalesce(q.noi_dung, ''), '\s+', ' ', 'g') AS nd,
         coalesce(q.dich, '') || ' ' || coalesce(q.dich_cuoi, '') AS l
  FROM qc_meta q WHERE (coalesce(q.dich, '') || coalesce(q.dich_cuoi, '')) ~* '(netshort|dramabox|reelshort)'
), khop AS (
  SELECT 'ten:' || lower(regexp_replace(l2.ten, '[^[:alnum:]]+', '', 'g')) AS khoa, qc.* FROM qc JOIN ethopex_ldp l2 ON l2.ma = substring(qc.l, 'netshort-h5-landing-page/([A-Za-z0-9_-]+)\.html') WHERE l2.ten IS NOT NULL
  UNION ALL SELECT substring(qc.l, '[?&]bid=(\d{11})'), qc.* FROM qc WHERE qc.l ~ 'dramabox\.com.*[?&]bid=\d{11}'
  UNION ALL SELECT substring(qc.l, '([0-9a-f]{24})'), qc.* FROM qc WHERE qc.l ~* 'reelshort' AND qc.l ~ '[0-9a-f]{24}'
), ec AS (
  SELECT e.id, CASE WHEN e.nguon = 'netshort' THEN 'ten:' || lower(regexp_replace(e.ten, '[^[:alnum:]]+', '', 'g')) ELSE coalesce(e.ma_goc, substring(e.url, '/video/(\d{11})_')) END AS khoa
  FROM ethopex_content e WHERE e.id = ANY (string_to_array(:'ids', ',')::int[])
)
SELECT e.id, k.library_id, k.page_id, (k.ngay_dung IS NULL) AS dang_chay, k.video_luc, coalesce(k.video_hd, k.video_sd, '') AS video, k.nd
FROM ec e JOIN khop k ON k.khoa = e.khoa
ORDER BY e.id, k.video_luc DESC NULLS LAST;
