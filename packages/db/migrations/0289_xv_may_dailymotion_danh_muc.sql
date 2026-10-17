-- Danh mục Dailymotion là của KÊNH (trước gắn cứng 'travel' trong dang-dailymotion.mts — máy ngách khác sẽ sai danh mục). Hotel Scam Alerts: travel.
UPDATE xv_may SET dang = (SELECT jsonb_agg(CASE WHEN n->>'nen' = 'dailymotion' THEN jsonb_set(n, '{br,danh_muc}', '"travel"') ELSE n END) FROM jsonb_array_elements(dang) n)
WHERE ma = 'ratesbyroom-scam-or-real';
