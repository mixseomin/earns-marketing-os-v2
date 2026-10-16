-- Sổ nguồn AI của studio (apps/xuong-video/src/lib/xuong-video/nguon-ai.ts): mọi bên cung cấp model (API trực tiếp, cổng bán lại, tài khoản web)
-- + từng model ở từng bên, giá quy về VNĐ thật theo đơn vị chuẩn của loại. Ổn định KHÔNG lưu ở đây — tính từ xv_job qua ma_job ('provider|model').
-- Khoá API không bao giờ nằm ở đây: khoa_env chỉ là TÊN biến môi trường để máy kiểm có / chưa có.
CREATE TABLE IF NOT EXISTS xv_nguon (
  key text PRIMARY KEY,
  ten text NOT NULL,
  kieu text NOT NULL DEFAULT '',
  trang_thai text NOT NULL DEFAULT 'tham_khao' CHECK (trang_thai IN ('dang', 'co_tk', 'tham_khao', 'ngung')),
  loai text NOT NULL DEFAULT '',
  tra_tien text NOT NULL DEFAULT '',
  vault text NOT NULL DEFAULT '',
  nap_tien text NOT NULL DEFAULT '',
  khoa_env text NOT NULL DEFAULT '',
  rui_ro text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS xv_nguon_model (
  id serial PRIMARY KEY,
  nguon_key text NOT NULL REFERENCES xv_nguon(key),
  loai text NOT NULL CHECK (loai IN ('video', 'anh', 'giong', 'am', 'chu')),
  model text NOT NULL,
  goi text NOT NULL DEFAULT '',
  gia_vnd numeric,
  gia_goc text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  link_phu text NOT NULL DEFAULT '',
  ngay_doc date,
  kha_nang text NOT NULL DEFAULT '',
  khop jsonb NOT NULL DEFAULT '[null,null,null,null,null,null]'::jsonb,
  tat text NOT NULL DEFAULT '',
  ma_job text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nguon_key, loai, model, goi),
  -- Giá phải có link tới trang chứa giá đó (anh 16/10/2026: "cấm bịa") — không có link thì không được có giá.
  CONSTRAINT xv_nguon_model_gia_co_link CHECK (gia_vnd IS NULL OR link <> '')
);

INSERT INTO xv_nguon (key, ten, kieu, trang_thai, loai, tra_tien, vault, nap_tien, khoa_env, rui_ro) VALUES
  ('google', 'Google AI Studio', 'API trực tiếp', 'dang', 'ảnh, video', 'Tín dụng trả trước', '', 'https://ai.studio/projects', 'GOOGLE_API_KEY|GEMINI_API_KEY', 'Veo gọi thẳng hay hết lượt / ngày'),
  ('fal', 'fal.ai', 'Chợ model', 'dang', 'ảnh, video, giọng, âm', 'Thẻ', '', 'https://fal.ai/dashboard/billing', 'FAL_KEY', 'Giá đọc tự động từ trang model'),
  ('shopaikey', 'ShopAIKey', 'Cổng bán lại', 'dang', 'ảnh, video Grok', 'Xu VNĐ ($1 = 3.250₫)', '#532', 'https://shopaikey.com/account', 'SHOPAIKEY_API_KEY', 'Video ra khung 2:3; Veo Fast treo hàng đợi'),
  ('ckey', 'ckey.vn', 'Chợ người bán', 'dang', 'ảnh', 'VNĐ', '#534', 'https://ckey.vn/deposit', 'CKEY_API_KEY', 'Người bán đổi tên / gỡ model bất chợt'),
  ('anthropic', 'Anthropic', 'API trực tiếp', 'dang', 'chữ', 'Thẻ', '', 'https://console.anthropic.com', 'ANTHROPIC_API_KEY', ''),
  ('openai', 'OpenAI', 'API trực tiếp', 'dang', 'ảnh', 'Thẻ', '', 'https://platform.openai.com', 'OPENAI_API_KEY', ''),
  ('apimaster', 'APIMaster.ai', 'Cổng bán lại', 'co_tk', 'ảnh, video Seedance / Kling', 'USDT / Epay', '#533', 'https://apimaster.ai', 'APIMASTER_API_KEY', 'Chưa nối vào studio'),
  ('atlas', 'Atlas Cloud', 'Cổng bán lại', 'tham_khao', 'video Kling 3.0, MiniMax H3, Seedance', 'Thẻ', '', 'https://www.atlascloud.ai/models/kling-v3', 'ATLAS_API_KEY', 'Giá "từ" — chưa rõ bật tiếng có tính thêm'),
  ('khotk', 'khotaikhoan.net', 'Tài khoản web', 'tham_khao', 'video Kling (trên web)', 'Chuyển khoản', '', 'https://khotaikhoan.net/tai-khoan-kling-ai/', '', 'Không có API · tài khoản bán lại · gói Ultra bảo hành 3 ngày')
ON CONFLICT (key) DO NOTHING;

-- khop theo thứ tự nguon-ai.ts › VIEC_NGUON: QC người thật · Giữ nhân vật · Cận sản phẩm · Hoạt hình / 3D · Thoại khớp miệng · Nối khung khoá
-- (1 nên dùng · 0 được · -1 cấm · null chưa rõ). gia_vnd = giá NIÊM YẾT trên trang `link` quy về đơn vị chuẩn (26.000₫ ≈ $1; ShopAIKey $1 credit
-- = 3.250₫ tiền nạp thật), đọc 16/10/2026; link_phu = trang thứ hai khi phép quy đổi cần (vd số credit / giây của Kling). Tiền thật đã trừ
-- không nằm ở đây — tính từ xv_job.
INSERT INTO xv_nguon_model (nguon_key, loai, model, goi, gia_vnd, gia_goc, link, link_phu, ngay_doc, kha_nang, khop, tat, ma_job) VALUES
  ('shopaikey', 'video', 'Grok Video 3', '', 3250, '1 credit / clip 10s (nhóm kênh 2; kênh 1 là 2,5 credit)', 'https://shopaikey.com/models', '', '2026-10-16', '10s · khung 2:3 · có tiếng', '[-1,0,0,0,-1,-1]', 'Tự in phụ đề giả lên hình dù prompt cấm (#54 shot 6, 9)', '{shopaikey|grok-video-3-10s}'),
  ('khotk', 'video', 'Kling 3.0 (web)', 'Gói Std 12K', 7960, '1.990.000₫ / 12.000 credit × 48 credit (8s × 6 credit/s 720p không tiếng)', 'https://khotaikhoan.net/tai-khoan-kling-ai/', 'https://kling.ai/blog/kling-video-3-0-credit-cost-guide', '2026-10-16', '3–15s · làm tay trên web', '[1,1,1,0,0,0]', '', '{}'),
  ('khotk', 'video', 'Kling 3.0 (web)', 'Gói Ultra 27.5K', 4695, '2.690.000₫ / 27.500 credit × 48 credit · bảo hành 3 ngày', 'https://khotaikhoan.net/tai-khoan-kling-ai/', 'https://kling.ai/blog/kling-video-3-0-credit-cost-guide', '2026-10-16', '3–15s · làm tay trên web', '[1,1,1,0,0,0]', '', '{}'),
  ('google', 'video', 'Veo 3.1 Lite', '', 10400, '$0,05 / giây 720p (giá mặc định, có tiếng)', 'https://ai.google.dev/gemini-api/docs/pricing', '', '2026-10-16', '4–8s · 9:16 · khung đầu + cuối', '[1,0,1,0,0,1]', '', '{google|veo-3.1-lite-generate-preview}'),
  ('fal', 'video', 'Veo 3.1 Lite', '', 6240, '$0,03 / giây 720p không tiếng', 'https://fal.ai/models/fal-ai/veo3.1/lite/image-to-video', '', '2026-10-16', '4–8s · 9:16 · khung đầu + cuối', '[1,0,1,0,0,1]', '', '{fal|fal:fal-ai/veo3.1/lite/image-to-video}'),
  ('google', 'video', 'Veo 3.1 Fast', '', 20800, '$0,10 / giây 720p (có tiếng)', 'https://ai.google.dev/gemini-api/docs/pricing', '', '2026-10-16', '4–8s · 9:16', '[1,0,1,0,1,1]', '', '{google|veo-3.1-fast-generate-preview}'),
  ('atlas', 'video', 'Kling 3.0 Std', '', 14768, '$0,071 / giây (gốc $0,084)', 'https://www.atlascloud.ai/models/kling-v3', '', '2026-10-16', '3–15s · có tiếng', '[1,1,1,0,0,0]', '', '{}'),
  ('atlas', 'video', 'Kling 3.0 Pro', '', 19760, '$0,095 / giây (gốc $0,112)', 'https://www.atlascloud.ai/models/kling-v3', '', '2026-10-16', '3–15s · có tiếng · 1080p', '[1,1,1,0,0,0]', '', '{}'),
  ('atlas', 'video', 'Kling O3 Std · ảnh tham chiếu', '', 14768, '$0,071 / giây', 'https://www.atlascloud.ai/models/kling-v3', '', '2026-10-16', 'reference-to-video · giữ người từ ảnh', '[1,1,1,0,0,0]', '', '{}'),
  ('fal', 'video', 'Kling 3.0 Pro', '', 23296, '$0,112 / giây (tắt tiếng); $0,168 bật tiếng', 'https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video', '', '2026-10-16', '3–15s · có tiếng', '[1,1,1,0,0,0]', '', '{fal|fal:fal-ai/kling-video/v3/pro/image-to-video}'),
  ('apimaster', 'video', 'Kling v3 Omni', '', 17472, 'model_price 0,084 (theo giây)', 'https://apimaster.ai/api/pricing', '', '2026-10-16', '9:16', '[1,1,1,0,0,0]', '', '{}'),
  ('apimaster', 'video', 'Seedance 2.0 Mini', '', 15725, 'model_price 0,0756 (theo giây)', 'https://apimaster.ai/api/pricing', '', '2026-10-16', '9:16', '[0,0,1,0,null,null]', '', '{}'),
  ('fal', 'video', 'Pikaframes', '', 8320, '$0,04 / giây 720p · tối thiểu 5s', 'https://fal.ai/models/fal-ai/pika/v2.2/pikaframes', '', '2026-10-16', '2–5 khung khoá · không tiếng', '[-1,0,0,1,-1,1]', 'Thiếu cảm xúc, chỉ biến hình giữa hai khung', '{fal|fal:fal-ai/pika/v2.2/pikaframes}'),
  ('fal', 'video', 'H3 Max 3D→Video', '', 16640, '$0,08 / giây 768p · tối thiểu 5s', 'https://fal.ai/models/minimax/h3-max/3d-to-video', '', '2026-10-16', 'nhận clip diễn Blender', '[-1,0,0,1,-1,0]', '', '{fal|fal:minimax/h3-max/3d-to-video}'),
  ('fal', 'video', 'Seedance 2.5', '', 98384, '~$0,4730 / giây 720p có tiếng', 'https://fal.ai/models/bytedance/seedance-2.5/image-to-video', '', '2026-10-16', '9:16 · có tiếng', '[1,1,1,0,0,0]', '', '{fal|fal:bytedance/seedance-2.5/image-to-video}'),
  ('ckey', 'anh', 'Nano Banana 2', 'wowztools', 110.5, '110,5₫ / ảnh · chợ ghi 95,3% thành công', 'https://ckey.vn/ajax/apiai-public-catalog?lang=vi&page=1&per_page=100', '', '2026-10-16', '768×1376 · giữ người theo ảnh tham chiếu', '[1,1,1,0,null,null]', '', '{ckey|ckey:wowztools/nano-banana-2,ckey|ckey:wowztools/Nano-Banana-2,ckey|wowztools/nano-banana-2}'),
  ('ckey', 'anh', 'Nano Banana Pro', 'wowztools', 110.5, '110,5₫ / ảnh · chợ ghi 96,1% thành công', 'https://ckey.vn/ajax/apiai-public-catalog?lang=vi&page=1&per_page=100', '', '2026-10-16', '9:16', '[1,1,1,0,null,null]', '', '{ckey|ckey:wowztools/nano-banana-pro,ckey|wowztools/nano-banana-pro}'),
  ('fal', 'anh', 'Seedream 5 Pro edit', '', 1755, '$0,0675 / ảnh (giá tạm) + $0,0045 mỗi ảnh vào thêm', 'https://fal.ai/models/bytedance/seedream/v5/pro/edit', '', '2026-10-16', 'sửa ảnh theo tham chiếu', '[0,1,1,1,null,null]', '', '{fal|fal:bytedance/seedream/v5/pro/edit}'),
  ('shopaikey', 'anh', 'Nano Banana 2.1', '', 683, '0,21 credit / ảnh', 'https://shopaikey.com/models', '', '2026-10-16', '9:16', '[1,1,1,0,null,null]', '', '{shopaikey|shopaikey:gemini-nano-banana-2.1,shopaikey|gemini-nano-banana-2.1}'),
  ('openai', 'anh', 'gpt-image-1.5', '', NULL, 'chưa đọc được giá: trang giá OpenAI dựng bằng JS', 'https://platform.openai.com/docs/pricing', '', '2026-10-16', 'chữ trên ảnh rõ', '[0,0,1,1,null,null]', '', '{openai|gpt-image-1.5}'),
  ('google', 'anh', 'Nano Banana 2.1', '', 873.6, '$0,0336 / ảnh 1K', 'https://ai.google.dev/gemini-api/docs/pricing', '', '2026-10-16', '9:16 · 1K / 2K / 4K', '[1,1,1,0,null,null]', '', '{google|gemini-nano-banana-2.1}'),
  ('apimaster', 'anh', 'Seedream 5 Pro', '', 1170, 'model_price 0,045 / ảnh', 'https://apimaster.ai/api/pricing', '', '2026-10-16', '9:16', '[0,1,1,1,null,null]', '', '{}'),
  ('apimaster', 'anh', 'Gemini 3.1 Flash Image', '', 1742, 'model_price 0,067 / ảnh', 'https://apimaster.ai/api/pricing', '', '2026-10-16', '9:16', '[1,1,1,0,null,null]', '', '{}'),
  ('google', 'anh', 'Gemini 3 Pro Image', '', 3484, '$0,134 / ảnh 1K–2K', 'https://ai.google.dev/gemini-api/docs/pricing', '', '2026-10-16', '1K / 2K / 4K', '[1,1,1,0,null,null]', '', '{google|gemini-3-pro-image}'),
  ('fal', 'giong', 'ElevenLabs v3', '', 2600, '$0,10 / 1.000 ký tự', 'https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3', '', '2026-10-16', 'đa ngôn ngữ · thẻ cảm xúc', '[1,null,null,1,1,null]', '', '{fal|fal:fal-ai/elevenlabs/tts/eleven-v3}'),
  ('fal', 'giong', 'ElevenLabs v4', '', NULL, 'chưa đọc giá', '', '', NULL, 'đa ngôn ngữ', '[1,null,null,1,1,null]', '', '{fal|fal:elevenlabs/tts/eleven-v4}'),
  ('fal', 'am', 'ElevenLabs SFX v2', '', 1560, '$0,002 / giây', 'https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2', '', '2026-10-16', 'hiệu ứng ≤ 22s', '[1,null,null,1,null,null]', '', '{fal|fal:fal-ai/elevenlabs/sound-effects/v2}'),
  ('fal', 'am', 'CassetteAI nhạc', '', 260, '$0,02 / phút', 'https://fal.ai/models/cassetteai/music-generator', '', '2026-10-16', 'nhạc nền', '[1,null,null,1,null,null]', '', '{fal|fal:cassetteai/music-generator}'),
  ('fal', 'am', 'ElevenLabs Music', '', 7800, '$0,6 / phút', 'https://fal.ai/models/fal-ai/elevenlabs/music', '', '2026-10-16', 'nhạc có lời', '[1,null,null,1,null,null]', '', '{fal|fal:fal-ai/elevenlabs/music}'),
  ('anthropic', 'chu', 'Claude Opus 5.5', '', 4680, '$4 / 1M token vào · $20 / 1M token ra', 'https://www.anthropic.com/pricing', '', '2026-10-16', 'tách cảnh · kiểm người xem', '[null,null,null,null,null,null]', '', '{anthropic|claude-opus-5-5}'),
  ('anthropic', 'chu', 'Claude Haiku 4.5', '', 1170, '$1 / 1M token vào · $5 / 1M token ra', 'https://www.anthropic.com/pricing', '', '2026-10-16', 'dịch mô tả shot', '[null,null,null,null,null,null]', '', '{anthropic|claude-haiku-4-5}')
ON CONFLICT (nguon_key, loai, model, goi) DO NOTHING;
