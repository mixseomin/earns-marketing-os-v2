-- Ghi giọng đã đọc ("model|voice") vào từng dòng thoại đã có file, lấy từ job giọng sinh ra file đó — bản xuất đếm số giọng của
-- lời dẫn để bắt phim lẫn giọng (10/10/2026). Từ nay hoan-tat ghi trực tiếp lúc job xong; đây là phần bù cho file sinh trước đó.
UPDATE xv_canh c SET thoai = (
  SELECT jsonb_agg(
    CASE WHEN e.d ? 'giong' OR coalesce(e.d->>'url', '') = '' THEN e.d
         ELSE e.d || coalesce((SELECT jsonb_build_object('giong', regexp_replace(j.model, '^fal:', '') || '|' || (j.request->>'voice'))
                               FROM xv_job j WHERE j.loai = 'am' AND j.output_url = e.d->>'url' AND j.request ? 'voice' ORDER BY j.id DESC LIMIT 1), '{}'::jsonb)
    END ORDER BY e.o)
  FROM jsonb_array_elements(c.thoai) WITH ORDINALITY AS e(d, o))
WHERE jsonb_typeof(c.thoai) = 'array' AND jsonb_array_length(c.thoai) > 0
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.thoai) x WHERE coalesce(x->>'url', '') <> '' AND NOT x ? 'giong');
