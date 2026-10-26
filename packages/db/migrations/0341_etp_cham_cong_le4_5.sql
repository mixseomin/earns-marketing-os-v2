-- LUẬT CHẤM MỚI (anh 26/10/2026: "Các camp có creative <= 4 điểm chấm META hoặc GG đều tắt camp tự động nếu đang chạy, và chặn ko cho lên camp nếu bị dính.
-- 5 điểm thì sẽ cần review người thật" · "Áp dụng cho mọi loại camp" · "kể cả đang lãi") — thay luật "kiểu 1" 25/10 (chỉ Meta + AFS CTA/dụ nhấp chặn):
--   bất kỳ tiêu chí meta.* hoặc afs.* (GG) ≤ 4  → chặn lên + máy tự tắt camp đang chạy (cột tat)
--   có tiêu chí = 5 (không có ≤ 4)              → chặn lên tới khi người duyệt Đạt (etp.cham_duyet); camp đang chạy: báo duyệt, không tự tắt
--   người duyệt Loại                             → như ≤ 4 (chặn + tự tắt)
CREATE TABLE IF NOT EXISTS etp.cham_duyet (
  creative_id integer PRIMARY KEY,
  ok          boolean NOT NULL,
  ai          text,
  ghi         text,
  luc         timestamptz NOT NULL DEFAULT now()
);
DROP VIEW IF EXISTS etp.cham_cong;
CREATE VIEW etp.cham_cong AS
WITH d AS (
  SELECT c.creative_id,
         (SELECT string_agg(e.k || ' ' || e.v, ', ' ORDER BY e.v::numeric) FROM jsonb_each_text(c.diem) e(k, v) WHERE (e.k LIKE 'meta.%' OR e.k LIKE 'afs.%') AND e.v::numeric <= 4) AS le4,
         (SELECT string_agg(e.k || ' ' || e.v, ', ') FROM jsonb_each_text(c.diem) e(k, v) WHERE (e.k LIKE 'meta.%' OR e.k LIKE 'afs.%') AND e.v::numeric = 5) AS bang5,
         u.ok AS duyet
  FROM etp.cham c LEFT JOIN etp.cham_duyet u USING (creative_id)
)
SELECT creative_id,
       (le4 IS NULL AND duyet IS DISTINCT FROM false AND (bang5 IS NULL OR duyet IS TRUE)) AS duoc_len,
       COALESCE(le4, CASE WHEN duyet IS FALSE THEN 'người duyệt loại' WHEN bang5 IS NOT NULL AND duyet IS NOT TRUE THEN 'chờ người duyệt (5 điểm: ' || bang5 || ')' END) AS chan_boi,
       (le4 IS NOT NULL OR duyet IS FALSE) AS tat,
       CASE WHEN le4 IS NULL AND bang5 IS NOT NULL AND duyet IS NULL THEN bang5 END AS cho_duyet
FROM d;
