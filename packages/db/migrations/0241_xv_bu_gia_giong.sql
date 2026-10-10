-- Bù sổ: lượt giọng ElevenLabs v3 qua fal bị ghi $0 vì danh mục fal trống giá và giá trang riêng đọc nền chưa kịp về (script trên box).
-- Giá đã đọc tay trong MO_HINH_AM: 10¢ / 1.000 ký tự. Cộng cả vào chi phí của shot (hoan-tat cộng request.gia = 0 lúc xong).
WITH bu AS (
  UPDATE xv_job SET chi_phi_cents = round(length(request->>'text') / 1000.0 * 10, 3),
    request = request || jsonb_build_object('gia', round(length(request->>'text') / 1000.0 * 10, 3), 'gia_bu', '0241')
  WHERE loai = 'am' AND model = 'fal:fal-ai/elevenlabs/tts/eleven-v3' AND trang_thai = 'xong' AND chi_phi_cents = 0
    AND request->>'dich' = 'thoai' AND coalesce(request->>'text', '') <> ''
  RETURNING canh_id, chi_phi_cents)
UPDATE xv_canh c SET chi_phi_cents = c.chi_phi_cents + t.cong FROM (SELECT canh_id, sum(chi_phi_cents) AS cong FROM bu WHERE canh_id IS NOT NULL GROUP BY canh_id) t WHERE c.id = t.canh_id;
