-- FB của máy ratesbyroom-scam-or-real đăng qua Graph API trên box3 (17/10/2026, anh chốt: htuan82 làm admin Page + app riêng "Kenh Social Poster"
-- 1850293666145431 không gắn Business Manager quảng cáo). Token Page ở /root/.secrets/fb-pages.json (không hết hạn). Không còn cần phiên trình duyệt
-- doanhedu trên MacBook → nền chạy từ iMac. graph_id = id Page trên Graph (khác page_id hồ sơ web mà đường br dùng — giữ để quay lại br khi cần).
UPDATE xv_may m SET dang = (
  SELECT jsonb_agg(CASE WHEN d->>'nen' = 'facebook'
    THEN d || '{"may": "iMac", "gio": "20:00", "kem": "link ratesbyroom.com trong bình luận · đăng qua Graph API (box3)"}'::jsonb
           || jsonb_build_object('br', (d->'br') || '{"api": true, "graph_id": "1357352200797299"}'::jsonb)
    ELSE d END ORDER BY o)
  FROM jsonb_array_elements(m.dang) WITH ORDINALITY AS t(d, o))
WHERE m.ma = 'ratesbyroom-scam-or-real';
