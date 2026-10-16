-- Sổ nguồn AI: tài khoản ElevenLabs trong vault (#130, gói Free, có API key) — ghi để thấy trong sổ (anh 16/10/2026 "cứ gom vào, khi nào cần
-- thì nâng trả fee"). Gói Free KHÔNG được dùng thương mại + phải ghi "Made with ElevenLabs" → để trạng thái "có tài khoản, chưa nối"; quảng cáo cần
-- gói Starter trở lên. Giá để trống (gói Free không có giá theo ký tự để quy đổi).
INSERT INTO xv_nguon (key, ten, kieu, trang_thai, loai, tra_tien, vault, nap_tien, khoa_env, rui_ro) VALUES
  ('elevenlabs', 'ElevenLabs', 'API trực tiếp', 'co_tk', 'giọng, hiệu ứng, nhạc', 'Free (10.000 credit/tháng) · nâng gói bằng thẻ', '#130', 'https://elevenlabs.io/pricing', 'ELEVENLABS_API_KEY',
   'Gói Free: không dùng thương mại, phải ghi "Made with ElevenLabs" — quảng cáo cần gói Starter trở lên. Đang gọi ElevenLabs qua fal (đã có quyền thương mại).')
ON CONFLICT (key) DO NOTHING;
INSERT INTO xv_nguon_model (nguon_key, loai, model, gia_vnd, gia_goc, link, ngay_doc, kha_nang, khop, tat, ma_job) VALUES
  ('elevenlabs', 'giong', 'ElevenLabs v3 (trực tiếp)', NULL, 'gói Free 10.000 credit/tháng — không thương mại', 'https://elevenlabs.io/pricing', '2026-10-16', 'đa ngôn ngữ · thẻ cảm xúc · giọng nhân bản (gói trả phí)', '[-1,null,null,1,1,null]', 'Gói Free không có quyền thương mại — không dùng cho quảng cáo', '{}')
ON CONFLICT (nguon_key, loai, model, goi) DO NOTHING;
