-- QC thật của app gốc cho từng content Ethopex (cùng cách ghép của view ethopex_uu_tien trên spy.on.tc), kèm video + chữ.
-- Chạy trên DB spy:  ssh root@167.233.241.16 '. /root/.secrets/spy.env; psql "$DATABASE_URL" -v ids=94344,70634 -tA -F"	" -f -' < qc-spy-phim.sql
-- ĐI QUA CHỈ MỤC (17/11/2026, lỗi etp:qua-tai-nhan-ban): bản cũ dựng bảng qc từ MỌI QC netshort/dramabox/reelshort (79.333 dòng, regex ~* + regexp_replace
-- noi_dung từng dòng) rồi mới ghép khoá → 11 giây lúc rỗi, ~50–110 giây khi 40 lượt nhan-ban (kiem-phim-18) chạy cùng lúc, box3 hết CPU.
-- Nay: khoá của phim trước (ec) → mẫu chuỗi phải có trong link (pat) → lấy ứng viên qua chỉ mục trigram qc_meta_dich_trgm (đúng biểu thức của chỉ mục)
-- → khop giữ NGUYÊN ba điều kiện ghép cũ trên ứng viên (kết quả y hệt) → regexp_replace noi_dung chỉ trên dòng ra.
WITH ec AS (
  SELECT e.id, CASE WHEN e.nguon = 'netshort' THEN 'ten:' || lower(regexp_replace(e.ten, '[^[:alnum:]]+', '', 'g')) ELSE coalesce(e.ma_goc, substring(e.url, '/video/(\d{11})_')) END AS khoa
  FROM ethopex_content e WHERE e.id = ANY (string_to_array(:'ids', ',')::int[])
), ldp AS (
  SELECT l2.ma, 'ten:' || lower(regexp_replace(l2.ten, '[^[:alnum:]]+', '', 'g')) AS khoa FROM ethopex_ldp l2 WHERE l2.ten IS NOT NULL
), pat AS (
  SELECT DISTINCT p FROM (
    SELECT '%netshort-h5-landing-page/' || ldp.ma || '.html%' AS p FROM ec JOIN ldp ON ldp.khoa = ec.khoa
    UNION ALL SELECT '%' || ec.khoa || '%' FROM ec WHERE ec.khoa ~ '^(\d{11}|[0-9a-f]{24})$'
  ) x
), qc AS MATERIALIZED (
  SELECT DISTINCT ON (q.library_id) q.library_id, q.page_id, q.ngay_dung, q.video_hd, q.video_sd, q.video_luc, q.noi_dung,
         coalesce(q.dich, '') || ' ' || coalesce(q.dich_cuoi, '') AS l
  FROM pat JOIN qc_meta q ON (COALESCE(q.dich, ''::text) || COALESCE(q.dich_cuoi, ''::text)) LIKE pat.p
  WHERE (coalesce(q.dich, '') || coalesce(q.dich_cuoi, '')) ~* '(netshort|dramabox|reelshort)'
), khop AS (
  SELECT ldp.khoa, qc.* FROM qc JOIN ldp ON ldp.ma = substring(qc.l, 'netshort-h5-landing-page/([A-Za-z0-9_-]+)\.html')
  UNION ALL SELECT substring(qc.l, '[?&]bid=(\d{11})'), qc.* FROM qc WHERE qc.l ~ 'dramabox\.com.*[?&]bid=\d{11}'
  UNION ALL SELECT substring(qc.l, '([0-9a-f]{24})'), qc.* FROM qc WHERE qc.l ~* 'reelshort' AND qc.l ~ '[0-9a-f]{24}'
)
SELECT e.id, k.library_id, k.page_id, (k.ngay_dung IS NULL) AS dang_chay, k.video_luc, coalesce(k.video_hd, k.video_sd, '') AS video,
       regexp_replace(coalesce(k.noi_dung, ''), '\s+', ' ', 'g') AS nd
FROM ec e JOIN khop k ON k.khoa = e.khoa
ORDER BY e.id, k.video_luc DESC NULLS LAST;
