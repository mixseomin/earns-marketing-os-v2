-- CHỜ ANH DUYỆT (anh 22/11/2026: "show lên đây với status là chờ ta duyệt xong thì mới cho lên camp chính thức" + "Tao cần duyệt trên page này cơ mà !"):
-- creative nằm trong etp.cho_anh_duyet mà chưa có dòng etp.cham_duyet → duoc_len = false + cho_duyet = lý do. Mọi đường lên camp (nhan-ban cham_sach,
-- dong_phim, lenCampCr, cuu_cham) đã đọc view này nên tự chặn; Duyệt / Loại ở etp2 › Camp (ô "Chờ anh duyệt") ghi cham_duyet như nút Đạt / Loại cũ.
-- Giữ theo creative_id, hoặc theo tv_id (thư viện — anh-tinh.py --anh ghi lúc creative chưa có số).
CREATE TABLE IF NOT EXISTS etp.cho_anh_duyet (
  id serial PRIMARY KEY,
  creative_id int,
  tv_id int,
  ghi text NOT NULL DEFAULT '',
  tao timestamptz NOT NULL DEFAULT now(),
  CHECK (creative_id IS NOT NULL OR tv_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS cho_anh_duyet_uq_cr ON etp.cho_anh_duyet (creative_id) WHERE creative_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cho_anh_duyet_uq_tv ON etp.cho_anh_duyet (tv_id) WHERE tv_id IS NOT NULL;

CREATE OR REPLACE VIEW etp.cho_anh_duyet_cr AS
SELECT DISTINCT ON (coalesce(h.creative_id, v.creative_id)) coalesce(h.creative_id, v.creative_id) AS creative_id, h.ghi, h.tao
FROM etp.cho_anh_duyet h LEFT JOIN etp.thu_vien v ON v.id = h.tv_id
WHERE coalesce(h.creative_id, v.creative_id) IS NOT NULL
ORDER BY coalesce(h.creative_id, v.creative_id), h.tao;

CREATE OR REPLACE VIEW etp.cham_cong AS
WITH d AS (
  SELECT c.creative_id,
         (SELECT string_agg(e.k || ' ' || e.v, ', ' ORDER BY e.v::numeric) FROM jsonb_each_text(c.diem) e(k, v) WHERE (e.k LIKE 'meta.%' OR e.k LIKE 'afs.%') AND e.v::numeric <= 4
            AND NOT EXISTS (SELECT 1 FROM etp.tieu_chi_mien m WHERE m.dang = r.dang AND m.k = e.k)) AS le4,
         (SELECT string_agg(e.k || ' ' || e.v, ', ') FROM jsonb_each_text(c.diem) e(k, v) WHERE (e.k LIKE 'meta.%' OR e.k LIKE 'afs.%') AND e.v::numeric = 5
            AND NOT EXISTS (SELECT 1 FROM etp.tieu_chi_mien m WHERE m.dang = r.dang AND m.k = e.k)) AS bang5,
         u.ok AS duyet,
         (SELECT 'chờ anh duyệt' || CASE WHEN h.ghi <> '' THEN ' (' || h.ghi || ')' ELSE '' END FROM etp.cho_anh_duyet_cr h WHERE h.creative_id = c.creative_id) AS giu
  FROM etp.cham c LEFT JOIN etp.cham_duyet u USING (creative_id) LEFT JOIN etp.creative r ON r.creative_id = c.creative_id
)
SELECT creative_id,
       (((le4 IS NULL AND duyet IS DISTINCT FROM false) OR duyet IS TRUE) AND NOT (giu IS NOT NULL AND duyet IS NULL)) AS duoc_len,
       CASE WHEN duyet IS TRUE THEN NULL WHEN giu IS NOT NULL AND duyet IS NULL THEN giu
            ELSE COALESCE(le4, CASE WHEN duyet IS FALSE THEN 'người duyệt loại' END) END AS chan_boi,
       ((le4 IS NOT NULL AND duyet IS NOT TRUE) OR duyet IS FALSE) AS tat,
       CASE WHEN giu IS NOT NULL AND duyet IS NULL THEN giu END AS cho_duyet
FROM d;

-- 6 creative khung spy 22/11/2026 (Genie / Bugatti / 49869 / 80386 / 82854 / 85055) — chưa camp nào, anh duyệt trên trang
INSERT INTO etp.cho_anh_duyet (creative_id, ghi)
SELECT x, 'khung cảnh spy 22/11' FROM unnest(ARRAY[113335, 113336, 113337, 113338, 113339, 113340]) x
WHERE NOT EXISTS (SELECT 1 FROM etp.camp c WHERE c.creative_id = x) AND NOT EXISTS (SELECT 1 FROM etp.cham_duyet u WHERE u.creative_id = x)
ON CONFLICT DO NOTHING;
