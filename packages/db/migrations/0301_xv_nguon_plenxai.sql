-- Sổ nguồn AI: PlenX AI (plenxai.com, VN) — anh 21/10/2026 "lưu vào sổ nguồn". Giá đọc bảng "Giá theo model" (plenxai.com/new/credits, đăng nhập
-- mikerey887 #560) ngày 21/10/2026; nạp VietQR 100₫ = 1 credit (gói tháng Pro 149k/2.000 credit ≈ 74,5₫). Đơn vị chuẩn: video 1 clip 8s 720p,
-- ảnh 1 ảnh 1K. Đo thật 21/10/2026: Veo 3.1 Lite 720p 8s trừ đúng 6 credit, clip 720×1280 có tiếng. Studio gọi qua cong-plenxai.ts (đầu chuỗi Veo).
INSERT INTO xv_nguon (key, ten, kieu, trang_thai, loai, tra_tien, vault, nap_tien, khoa_env, rui_ro) VALUES
  ('plenxai', 'PlenX AI', 'Cổng bán lại', 'dang', 'ảnh, video', 'VietQR 100₫ = 1 credit (gói Pro ≈ 74,5₫)', '#560', 'https://plenxai.com/new/credits', '',
   'Gói thường không có khoá API: studio gọi API web bằng token đăng nhập (tệp /root/.secrets/plenxai.json, máy tự xoay; hỏng thì scripts/plenxai-token.sh). Credit nạp hạn 3 tháng. Dev API chính thức từ gói Ultimate 399k')
ON CONFLICT (key) DO NOTHING;

INSERT INTO xv_nguon_model (nguon_key, loai, model, goi, gia_vnd, gia_goc, link, ngay_doc, kha_nang, ma_job) VALUES
  ('plenxai', 'video', 'Veo 3.1 Lite', '', 600, '6 credit / clip 720p (1080p 8 credit = 800₫ · 4K 40 credit)', 'https://plenxai.com/new/credits', '2026-10-21', '4–8s · 9:16 / 16:9 · khung đầu + cuối · có tiếng', '{plenxai|veo3-lite}'),
  ('plenxai', 'video', 'Veo 3.1 Fast', '', 1000, '10 credit / clip 720p (1080p 14 credit = 1.400₫)', 'https://plenxai.com/new/credits', '2026-10-21', '4–8s · khung đầu + cuối', '{plenxai|veo3-fast}'),
  ('plenxai', 'video', 'Veo 3.1 Relaxed', '', 300, 'từ 3 credit / clip 720p (1080p từ 7) — hàng chờ chậm', 'https://plenxai.com/new/credits', '2026-10-21', 'chạy chậm (ETA ~5 phút)', '{}'),
  ('plenxai', 'video', 'Omni Flash', '', 800, 'từ 1 credit / giây 720p', 'https://plenxai.com/new/credits', '2026-10-21', '4–10s · khung đầu + cuối · 7 ảnh tham chiếu', '{}'),
  ('plenxai', 'video', 'Grok Video 1.5', '', 4800, 'từ 6 credit / giây 720p', 'https://plenxai.com/new/credits', '2026-10-21', '', '{}'),
  ('plenxai', 'video', 'Wan 3.0', '', 7200, 'từ 9 credit / giây 720p (480p 6 · 1080p 18)', 'https://plenxai.com/new/credits', '2026-10-21', 'khung cuối · 10 ảnh tham chiếu', '{}'),
  ('plenxai', 'video', 'Kling 3.0 Pro', '', 8000, 'từ 10 credit / giây 720p (có tiếng từ 12)', 'https://plenxai.com/new/credits', '2026-10-21', '', '{}'),
  ('plenxai', 'video', 'Kling 4.0 Omni', '', 10400, '13 credit / giây 720p (1080p 18)', 'https://plenxai.com/new/credits', '2026-10-21', 'có tiếng cùng giá', '{}'),
  ('plenxai', 'video', 'Seedance 2.5', '', 19200, 'từ 24 credit / giây 720p (480p 12 · 1080p 32)', 'https://plenxai.com/new/credits', '2026-10-21', '', '{}'),
  ('plenxai', 'anh', 'Nano Banana Pro', '', 200, '2 credit / ảnh 1K (2K 3 · 4K 4)', 'https://plenxai.com/new/credits', '2026-10-21', 'gói tháng có ảnh miễn phí mỗi ngày (Pro 100 ảnh)', '{}'),
  ('plenxai', 'anh', 'Nano Banana 2', '', 200, '2 credit / ảnh 1K (2K 4 · 4K 7)', 'https://plenxai.com/new/credits', '2026-10-21', '', '{}'),
  ('plenxai', 'anh', 'Seedream 4.5', '', 300, '3 credit / ảnh 1K', 'https://plenxai.com/new/credits', '2026-10-21', '', '{}'),
  ('plenxai', 'anh', 'GPT Image 2', 'low', 300, 'từ 3 credit / ảnh 1K low (medium 12 · high 27)', 'https://plenxai.com/new/credits', '2026-10-21', '', '{}')
ON CONFLICT (nguon_key, loai, model, goi) DO NOTHING;
