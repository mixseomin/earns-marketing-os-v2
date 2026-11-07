-- NGƯỜI DUYỆT THẮNG ĐIỂM (anh 07/11/2026, topic Telegram 🔍 Duyệt creative — nút ✅ Duyệt thì tự lên bước tiếp): cham_duyet.ok = true → được lên dù có tiêu chí ≤ 4,
-- không tính chặn / tắt. Trước: duyệt tay chỉ loại được, không mở được. Đo trước khi đổi: 14 dòng ok=true, 0 dòng đang bị chặn → không mở thêm creative nào.
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
       ((le4 IS NULL AND duyet IS DISTINCT FROM false) OR duyet IS TRUE) AS duoc_len,
       CASE WHEN duyet IS TRUE THEN NULL ELSE COALESCE(le4, CASE WHEN duyet IS FALSE THEN 'người duyệt loại' END) END AS chan_boi,
       ((le4 IS NOT NULL AND duyet IS NOT TRUE) OR duyet IS FALSE) AS tat,
       NULL::text AS cho_duyet   -- 5 điểm không còn chờ duyệt (06/11/2026); giữ cột cho nơi đọc cũ (dong_phim.py, lich-gio.py)
FROM d;
