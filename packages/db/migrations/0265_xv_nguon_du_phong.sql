-- Sổ nguồn AI: các bên DỰ PHÒNG chưa mua (anh 16/10/2026 "tìm trên mạng xem còn nhà cung cấp nào giá rẻ làm backup") — trạng thái Tham khảo.
-- Mọi giá đọc THẲNG trên trang `link` ngày 16/10/2026, quy về đơn vị chuẩn (video: 1 clip 8s; 26.000₫ ≈ $1). Trang không ghi giá đọc được → để trống giá.
INSERT INTO xv_nguon (key, ten, kieu, trang_thai, loai, tra_tien, nap_tien, khoa_env, rui_ro) VALUES
  ('kie', 'Kie.ai', 'Cổng bán lại', 'tham_khao', 'video Veo 3.1 / Kling 3.0 / Seedance / Wan, ảnh Nano Banana', 'Thẻ', 'https://kie.ai/', 'KIE_API_KEY', 'Tự ghi giá theo % so với chính hãng; tự nói lượt hỏng không tính tiền — chưa đo'),
  ('piapi', 'PiAPI', 'Cổng bán lại', 'tham_khao', 'video Veo / Kling / Seedance / Hailuo / Sora 2', 'Thẻ', 'https://piapi.ai/pricing', 'PIAPI_API_KEY', 'Bảng giá Veo không ghi phiên bản model'),
  ('wavespeed', 'WaveSpeedAI', 'Cổng bán lại', 'tham_khao', 'video Kling / Veo / Seedance / Wan / MiniMax H3, ảnh', 'Thẻ', 'https://wavespeed.ai/pricing', 'WAVESPEED_API_KEY', ''),
  ('cometapi', 'CometAPI', 'Cổng bán lại', 'tham_khao', 'video Wan / Vidu / Kling, ảnh, chữ', 'Thẻ', 'https://www.cometapi.com/pricing/', 'COMETAPI_KEY', 'Nhiều model tính theo token — chưa quy được về giây'),
  ('apigiare', 'API Giá Rẻ (apigiare.vn)', 'Cổng bán lại · VN', 'tham_khao', 'ảnh (Nano Banana, GPT-Image, Flux), chữ', 'VNĐ chuyển khoản', 'https://apigiare.vn/', 'APIGIARE_KEY', 'Chưa thấy model video; trang giá dựng bằng JS, chưa đọc được giá'),
  ('apihub247', 'APIHub247', 'Tài khoản web · VN', 'tham_khao', 'tài khoản Veo / Kling / Seedance (dùng trên web)', 'VNĐ', 'https://apihub247.com/en', '', 'Bán TÀI KHOẢN, không phải API; nhiều gói không bảo hành')
ON CONFLICT (key) DO NOTHING;

INSERT INTO xv_nguon_model (nguon_key, loai, model, goi, gia_vnd, gia_goc, link, ngay_doc, kha_nang, khop) VALUES
  ('kie', 'video', 'Veo 3.1 Lite', '1080p', 4550, '$0,175 / video 8s 1080p có tiếng (chính hãng $0,64)', 'https://kie.ai/', '2026-10-16', '8s · 1080p · có tiếng', '[1,0,1,0,0,1]'),
  ('kie', 'video', 'Veo 3.1 Fast', '1080p', 8450, '$0,325 / video 8s 1080p (chính hãng $0,96)', 'https://kie.ai/', '2026-10-16', '8s · 1080p · có tiếng', '[1,0,1,0,1,1]'),
  ('kie', 'video', 'Seedance 2.5', '', 17680, '$0,085 / giây', 'https://kie.ai/', '2026-10-16', 'tới 30s · 4K · nhiều ảnh tham chiếu', '[1,1,1,0,0,0]'),
  ('kie', 'anh', 'Nano Banana 2', '1K', 1040, '$0,04 / ảnh 1K (chính hãng $0,067)', 'https://kie.ai/', '2026-10-16', '1K / 2K / 4K', '[1,1,1,0,null,null]'),
  ('piapi', 'video', 'Veo Fast (không ghi phiên bản)', '', 12480, '$0,06 / giây không tiếng ($0,09 có tiếng)', 'https://piapi.ai/pricing', '2026-10-16', 'không tiếng', '[1,0,1,0,null,null]'),
  ('piapi', 'video', 'Veo (không ghi phiên bản)', '', 24960, '$0,12 / giây không tiếng ($0,24 có tiếng)', 'https://piapi.ai/pricing', '2026-10-16', 'không tiếng', '[1,0,1,0,null,null]'),
  ('wavespeed', 'video', 'MiniMax H3', '', 8320, '$0,04 / giây', 'https://wavespeed.ai/pricing', '2026-10-16', '', '[0,0,1,0,null,null]'),
  ('wavespeed', 'video', 'Wan 3.0', '', 10400, '$0,05 / giây', 'https://wavespeed.ai/pricing', '2026-10-16', '', '[0,0,1,0,null,null]'),
  ('wavespeed', 'video', 'Kling 3.0 Std', '', 17472, '$0,084 / giây', 'https://wavespeed.ai/pricing', '2026-10-16', 'có tiếng', '[1,1,1,0,0,0]'),
  ('wavespeed', 'video', 'Veo 3.1 Fast', '', 20800, '$0,10 / giây', 'https://wavespeed.ai/pricing', '2026-10-16', '9:16', '[1,0,1,0,1,1]'),
  ('wavespeed', 'video', 'Seedance 2.0', '', 24960, '$0,12 / giây', 'https://wavespeed.ai/pricing', '2026-10-16', '', '[1,1,1,0,0,0]'),
  ('wavespeed', 'anh', 'Nano Banana 2', '', 1170, '$0,045 / ảnh', 'https://wavespeed.ai/pricing', '2026-10-16', '', '[1,1,1,0,null,null]'),
  ('cometapi', 'video', 'Wan 3.0', '', 8320, '$0,04 / giây (chính hãng $0,05)', 'https://www.cometapi.com/pricing/', '2026-10-16', '', '[0,0,1,0,null,null]'),
  ('cometapi', 'video', 'Wan 3.0 Prime', '', 11315, '$0,0544 / giây (chính hãng $0,068)', 'https://www.cometapi.com/pricing/', '2026-10-16', '', '[0,0,1,0,null,null]')
ON CONFLICT (nguon_key, loai, model, goi) DO NOTHING;
