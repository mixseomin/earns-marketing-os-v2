-- Kho tài sản: khoá thương hiệu = tên miền shop (kinh_thanh.qc.link, bỏ www) — project của studio là nhãn chung 'studio'.
-- Sửa các dòng 0242 đã ghi theo project; thêm preset giọng lời dẫn từ phim đã khoá giong_dan (một dòng mỗi thương hiệu, phim mới nhất).
UPDATE xv_tai_san ts SET thuong_hieu = coalesce(nullif(regexp_replace(substring(p.kinh_thanh->'qc'->>'link' from '^https?://([^/]+)'), '^www\.', ''), ''), p.project), updated_at = now()
FROM xv_phim p WHERE p.id = (ts.nguon->>'phim_id')::int;
INSERT INTO xv_tai_san (loai, ten, thuong_hieu, du_lieu, nguon)
SELECT DISTINCT ON (th) 'giong', 'Giọng lời dẫn · ' || th || ' · ' || (p.kinh_thanh->'giong_dan'->>'voice'), th, p.kinh_thanh->'giong_dan', jsonb_build_object('phim_id', p.id)
FROM (SELECT p.*, coalesce(nullif(regexp_replace(substring(p.kinh_thanh->'qc'->>'link' from '^https?://([^/]+)'), '^www\.', ''), ''), p.project) AS th FROM xv_phim p) p
WHERE jsonb_typeof(p.kinh_thanh->'giong_dan') = 'object'
  AND NOT EXISTS (SELECT 1 FROM xv_tai_san x WHERE x.loai = 'giong' AND x.thuong_hieu = p.th)
ORDER BY th, p.id DESC;
