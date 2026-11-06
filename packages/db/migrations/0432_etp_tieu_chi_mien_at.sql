-- MIỄN TIÊU CHÍ CHẤM THEO DẠNG CREATIVE (anh 06/11/2026: "Sửa luật chấm với dạng AT thì nội dung trong creative kiểu này là do team hướng dẫn và passed"):
-- ảnh tĩnh (AT) dùng câu CTA / giọng đúng khuôn team hướng dẫn (anh-tinh.py CAU) → cổng chấm bỏ qua afs.cta cho dạng này (không chặn lên, không tự tắt, không chờ duyệt).
-- Thêm miễn cho dạng khác = thêm một dòng ở đây, không sửa view.
CREATE TABLE IF NOT EXISTS etp.tieu_chi_mien (
  dang  text NOT NULL,   -- etp.creative.dang
  k     text NOT NULL,   -- khoá điểm trong etp.cham.diem, vd 'afs.cta'
  ly_do text NOT NULL,
  luc   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dang, k)
);
INSERT INTO etp.tieu_chi_mien (dang, k, ly_do) VALUES ('ảnh tĩnh', 'afs.cta', 'CTA ảnh tĩnh theo khuôn team hướng dẫn và đã duyệt (anh 06/11/2026)') ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW etp.cham_cong AS
WITH d AS (
  SELECT c.creative_id,
         (SELECT string_agg(e.k || ' ' || e.v, ', ' ORDER BY e.v::numeric) FROM jsonb_each_text(c.diem) e(k, v) WHERE (e.k LIKE 'meta.%' OR e.k LIKE 'afs.%') AND e.v::numeric <= 4
            AND NOT EXISTS (SELECT 1 FROM etp.tieu_chi_mien m WHERE m.dang = r.dang AND m.k = e.k)) AS le4,
         (SELECT string_agg(e.k || ' ' || e.v, ', ') FROM jsonb_each_text(c.diem) e(k, v) WHERE (e.k LIKE 'meta.%' OR e.k LIKE 'afs.%') AND e.v::numeric = 5
            AND NOT EXISTS (SELECT 1 FROM etp.tieu_chi_mien m WHERE m.dang = r.dang AND m.k = e.k)) AS bang5,
         u.ok AS duyet
  FROM etp.cham c LEFT JOIN etp.cham_duyet u USING (creative_id) LEFT JOIN etp.creative r ON r.creative_id = c.creative_id
)
SELECT creative_id,
       (le4 IS NULL AND duyet IS DISTINCT FROM false AND (bang5 IS NULL OR duyet IS TRUE)) AS duoc_len,
       COALESCE(le4, CASE WHEN duyet IS FALSE THEN 'người duyệt loại' WHEN bang5 IS NOT NULL AND duyet IS NOT TRUE THEN 'chờ người duyệt (5 điểm: ' || bang5 || ')' END) AS chan_boi,
       (le4 IS NOT NULL OR duyet IS FALSE) AS tat,
       CASE WHEN le4 IS NULL AND bang5 IS NOT NULL AND duyet IS NULL THEN bang5 END AS cho_duyet
FROM d;
