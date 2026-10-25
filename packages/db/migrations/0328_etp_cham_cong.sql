-- CỔNG LÊN CAMP THEO BẢN CHẤM (anh 25/10/2026 chọn "kiểu 1", sau khi chấm loạt cho thấy kết luận "cấm" của máy rơi vào nhóm lãi nhất):
-- CHẶN khi bất kỳ tiêu chí Meta nào ≤ 4, hoặc AFS CTA / dụ nhấp ≤ 4 — đúng thứ Meta và luật AFS bắt thật.
-- An toàn thương hiệu / chất lượng / khớp nội dung đích: chỉ cảnh báo, không chặn. MỘT nguồn cho nhan-ban.py, len-sau-cham.py và trang etp.
CREATE OR REPLACE VIEW etp.cham_cong AS
SELECT c.creative_id,
       NOT EXISTS (SELECT 1 FROM jsonb_each_text(c.diem) e(k, v)
                   WHERE (e.k LIKE 'meta.%' OR e.k IN ('afs.cta', 'afs.du_nhap')) AND e.v::numeric <= 4) AS duoc_len,
       (SELECT string_agg(e.k || ' ' || e.v, ', ' ORDER BY e.v::numeric) FROM jsonb_each_text(c.diem) e(k, v)
         WHERE (e.k LIKE 'meta.%' OR e.k IN ('afs.cta', 'afs.du_nhap')) AND e.v::numeric <= 4) AS chan_boi
FROM etp.cham c;
