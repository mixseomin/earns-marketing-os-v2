-- Dailymotion cho máy Hotel Scam Alerts (18/10/2026): tài khoản #551 (averietopacio17, profile webshare-us) nâng Partner (miễn phí) để mở API keys;
-- Private API key ở box3 /root/.secrets/dailymotion.json, đăng qua apps/xuong-video/scripts/dang-dailymotion.mts (kiểm khoá ↔ username kênh trước khi đăng).
-- ten = USERNAME kênh (API /v2/profiles/<id> trả name = username). Chạy từ iMac 20:00 cùng lượt com.earns.may-dang (đường API, không mở trình duyệt).
UPDATE xv_may SET dang = dang || '[{"nen": "dailymotion", "ten": "Dailymotion", "tk": "hotelscamalerts", "may": "iMac", "gio": "20:00", "tran": 1,
  "kem": "link ratesbyroom.com trong mô tả · đăng qua API (box3)", "br": {"acct": "551", "ten": "hotelscamalerts", "profile_id": "x6f3gcy"}}]'::jsonb
WHERE ma = 'ratesbyroom-scam-or-real' AND NOT dang @> '[{"nen": "dailymotion"}]';
