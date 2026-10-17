-- Front Porch: YouTube + Facebook đăng từ iMac (17/10/2026, anh "có" — chuyển Front Porch khỏi MacBook). YouTube: Gmail đã đăng nhập profile militarycalc
-- trên iMac. Facebook: Graph API trên box3 (htuan82 admin Page Front Porch Puzzles, app Kenh Social Poster, token Page không hết hạn). Instagram còn ở MacBook
-- tới khi @frontporchpuzzles nối vào Page.
UPDATE xv_may m SET dang = (
  SELECT jsonb_agg(CASE
    WHEN d->>'nen' = 'youtube' THEN d || '{"may": "iMac"}'::jsonb
    WHEN d->>'nen' = 'facebook' THEN d || '{"may": "iMac", "kem": "mã FB20 trong mô tả · đăng qua Graph API (box3)"}'::jsonb
         || jsonb_build_object('br', (d->'br') || '{"api": true, "graph_id": "1373339879194511"}'::jsonb)
    ELSE d END ORDER BY o)
  FROM jsonb_array_elements(m.dang) WITH ORDINALITY AS t(d, o))
WHERE m.ma = 'front-porch-only-one';
