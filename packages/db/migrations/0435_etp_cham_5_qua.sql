-- CREATIVE 5 ĐIỂM QUA CỔNG, LÊN CAMP LUÔN (anh 06/11/2026 "Gỡ thêm cổng với creative 5 điểm chấm thì cho pass và lên camp luôn. Ko cần chấm lại"):
-- luật 26/10/2026 "5 điểm thì cần review người thật" bỏ — cổng chấm chỉ còn chặn ≤ 4 điểm và creative người duyệt loại. Không chấm lại: view đọc thẳng điểm đã có,
-- creative đang "chờ người duyệt" chuyển sang được lên ngay ở nhịp máy kế (hàng etp.cho_len_v). Cột bang5 vẫn tính để giữ nguyên khung view.
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
       (le4 IS NULL AND duyet IS DISTINCT FROM false) AS duoc_len,
       COALESCE(le4, CASE WHEN duyet IS FALSE THEN 'người duyệt loại' END) AS chan_boi,
       (le4 IS NOT NULL OR duyet IS FALSE) AS tat,
       NULL::text AS cho_duyet   -- 5 điểm không còn chờ duyệt (06/11/2026); giữ cột cho nơi đọc cũ (dong_phim.py, lich-gio.py)
FROM d;
