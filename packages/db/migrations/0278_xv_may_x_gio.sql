-- Nhãn giờ nền X của máy scam = giờ chạy thật (iMac:com.earns.may-dang 20:00), không còn 20:05 của lịch MacBook cũ.
UPDATE xv_may m SET dang = (
  SELECT jsonb_agg(CASE WHEN d->>'nen' = 'x' THEN d || '{"gio": "20:00"}'::jsonb ELSE d END ORDER BY o)
  FROM jsonb_array_elements(m.dang) WITH ORDINALITY AS t(d, o))
WHERE m.ma = 'ratesbyroom-scam-or-real';
