-- YouTube của máy ratesbyroom-scam-or-real chạy từ iMac (17/10/2026: anh đăng nhập Gmail makalynkentymtt82 vào profile militarycalc trên iMac) —
-- máy scam không còn nền nào cần MacBook (X + FB API + YouTube đều iMac 20:00).
UPDATE xv_may m SET dang = (
  SELECT jsonb_agg(CASE WHEN d->>'nen' = 'youtube' THEN d || '{"may": "iMac", "gio": "20:00"}'::jsonb ELSE d END ORDER BY o)
  FROM jsonb_array_elements(m.dang) WITH ORDINALITY AS t(d, o))
WHERE m.ma = 'ratesbyroom-scam-or-real';
