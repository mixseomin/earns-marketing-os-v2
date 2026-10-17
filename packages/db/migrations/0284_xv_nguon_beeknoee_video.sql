-- Beeknoee: video + ảnh (tham khảo), đọc https://platform.beeknoee.com/image-video-models ngày 18/10/2026. Giá trang tính theo GIÂY → quy về đơn vị
-- chuẩn sổ (1 clip 8s 720p); các model qua OpenRouter cộng thêm 15% (VAT + phí) chưa tính trong gia_vnd. Kết luận lúc đọc: đắt gấp 3–4 lần
-- Grok ShopAIKey (3.250₫/clip) và Veo Lite Kie (4.550₫/clip) — không thay đường đang dùng.
INSERT INTO xv_nguon_model (nguon_key, loai, model, goi, gia_vnd, gia_goc, link, ngay_doc, kha_nang) VALUES
  ('beeknoee', 'video', 'Grok Imagine Video 1.5 Lite', '720p', 8912, '1.114₫ / giây 720p (gốc 1.238₫) · qua OpenRouter +15%', 'https://platform.beeknoee.com/image-video-models', '2026-10-18', '1–15s · có tiếng · 480p 743₫/s'),
  ('beeknoee', 'video', 'Veo 3.1 Lite', '720p', 14848, '1.856₫ / giây 720p (gốc 2.063₫) · qua OpenRouter +15%', 'https://platform.beeknoee.com/image-video-models', '2026-10-18', '4/6/8s · có tiếng'),
  ('beeknoee', 'video', 'Seedance 2.0 Mini', '720p', 29504, '3.688₫ / giây 720p (gốc 4.098₫) · qua OpenRouter +15%', 'https://platform.beeknoee.com/image-video-models', '2026-10-18', '4–15s · có tiếng · 480p 1.638₫/s'),
  ('beeknoee', 'video', 'Wan 3.0', '720p', 29704, '3.713₫ / giây 720p (gốc 4.125₫) · qua OpenRouter +15%', 'https://platform.beeknoee.com/image-video-models', '2026-10-18', '2–30s · có tiếng'),
  ('beeknoee', 'video', 'Kling 3.0 Standard', '720p', 92400, '11.550₫ / giây 720p gói Free (Adv+ 8.250₫/s)', 'https://platform.beeknoee.com/image-video-models', '2026-10-18', '5–10s · có tiếng'),
  ('beeknoee', 'anh', 'GPT Image 1 Mini', 'Low', 138, '138₫ / ảnh chất lượng Low (Medium 413₫, High 990₫)', 'https://platform.beeknoee.com/image-video-models', '2026-10-18', 'OpenAI')
ON CONFLICT (nguon_key, loai, model, goi) DO NOTHING;
