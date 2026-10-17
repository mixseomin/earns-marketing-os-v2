-- Sổ nguồn AI thêm loại 'nhung' (embedding — biến chữ thành vector để tìm gần nghĩa: tra thư viện bối cảnh / diễn viên, gom QC đối thủ giống nhau)
-- + nguồn Beeknoee (cổng bán lại VN, tham khảo). Giá đọc https://platform.beeknoee.com/text-embedding-models ngày 17/10/2026, đơn vị 1 triệu token
-- vào; giá niêm yết là giá đang giảm (giá gốc trong gia_goc). Trang ghi model qua OpenRouter / OpenAI trực tiếp cộng thêm 15% (VAT 10% + phí 5%).
ALTER TABLE xv_nguon_model DROP CONSTRAINT IF EXISTS xv_nguon_model_loai_check;
ALTER TABLE xv_nguon_model ADD CONSTRAINT xv_nguon_model_loai_check CHECK (loai IN ('video', 'anh', 'giong', 'am', 'chu', 'nhung'));

INSERT INTO xv_nguon (key, ten, kieu, trang_thai, loai, tra_tien, vault, nap_tien, khoa_env, rui_ro) VALUES
  ('beeknoee', 'Beeknoee', 'Cổng bán lại', 'tham_khao', 'chữ, embedding, ảnh, video, giọng', 'VNĐ (gói Free / Basic / Advanced+)', '', 'https://platform.beeknoee.com', 'BEEKNOEE_API_KEY',
   'Giá embedding ≈ giá niêm yết OpenRouter quy VNĐ (không rẻ như ShopAIKey); model qua OpenRouter / OpenAI cộng 15% phí')
ON CONFLICT (key) DO NOTHING;

INSERT INTO xv_nguon_model (nguon_key, loai, model, goi, gia_vnd, gia_goc, link, ngay_doc, kha_nang) VALUES
  ('beeknoee', 'nhung', 'Qwen3 Embedding 8B', '', 371, '371₫ / 1M token (gốc 413₫) · qua OpenRouter +15%', 'https://platform.beeknoee.com/text-embedding-models', '2026-10-17', '4.096 chiều · 32K token · đa ngôn ngữ, top MTEB'),
  ('beeknoee', 'nhung', 'bge-m3', '', 371, '371₫ / 1M token (gốc 413₫) · qua OpenRouter +15%', 'https://platform.beeknoee.com/text-embedding-models', '2026-10-17', '1.024 chiều · 8K token · đa ngôn ngữ (có tiếng Việt)'),
  ('beeknoee', 'nhung', 'Multilingual-E5-Large', '', 371, '371₫ / 1M token (gốc 413₫) · qua OpenRouter +15%', 'https://platform.beeknoee.com/text-embedding-models', '2026-10-17', '1.024 chiều · 512 token · đa ngôn ngữ'),
  ('beeknoee', 'nhung', 'Nemotron 3 Embed 1B', '', 74, '74₫ / 1M token (gốc 83₫) · qua OpenRouter +15%', 'https://platform.beeknoee.com/text-embedding-models', '2026-10-17', '32K token · rẻ nhất trang'),
  ('beeknoee', 'nhung', 'Text Embedding 3 Small', '', 550, '550₫ / 1M token', 'https://platform.beeknoee.com/text-embedding-models', '2026-10-17', '1.536 chiều · chuẩn OpenAI'),
  ('beeknoee', 'nhung', 'Text Embedding 3 Large', '', 3575, '3.575₫ / 1M token', 'https://platform.beeknoee.com/text-embedding-models', '2026-10-17', '3.072 chiều'),
  ('beeknoee', 'nhung', 'Gemini Embedding 001', '', 4125, '4.125₫ / 1M token · gói Free có 50 lượt', 'https://platform.beeknoee.com/text-embedding-models', '2026-10-17', '3.072 chiều'),
  ('beeknoee', 'nhung', 'voyage-4-lite', '', 743, '743₫ / 1M token (gốc 825₫) · qua OpenRouter +15%', 'https://platform.beeknoee.com/text-embedding-models', '2026-10-17', '1.024 chiều · 32K token')
ON CONFLICT (nguon_key, loai, model, goi) DO NOTHING;
