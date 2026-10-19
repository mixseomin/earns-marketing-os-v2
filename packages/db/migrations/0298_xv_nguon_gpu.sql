-- Sổ nguồn AI thêm loại 'gpu' (máy GPU thuê theo giờ — dựng Blender Cycles, chạy model tự host), đơn vị 1 giờ · 1 thẻ, on-demand.
-- Anh 19/10/2026: "ckey có thuê GPU — so với RunPod có rẻ hơn không", rồi "check vast.ai/pricing, làm một bảng giống sổ nguồn AI".
-- Giá đọc 19/10/2026 (26.000₫ ≈ $1; ckey niêm yết thẳng VNĐ):
--   RunPod: API gpuTypes (communityPrice / securePrice) — cùng số trang https://www.runpod.io/pricing.
--   Vast.ai: API bundles công khai, máy 1 thẻ on-demand xếp theo dph_total (giá GPU + đĩa); gói "rẻ nhất" = máy rẻ nhất bất kể độ tin cậy,
--            gói "máy tin cậy" = reliability ≥ 98 % và RAM ≥ 30 GB (đúng ngưỡng máy dựng của may-thue.sh).
--   ckey.vn: /vi/ajax/getgpu3 của trang https://ckey.vn/rent-gpu3/ — trường dữ liệu trùng Vast.ai (reliability, max_duration, Community /
--            Datacenter) ⇒ bán lại máy Vast, đắt hơn Vast 2–4 lần cùng loại thẻ.
-- kha_nang ghi VRAM + tốc độ Cycles OptiX so RTX 4090 (= 1, bảng TOC trong scripts/bo-set/may-thue.sh) — giá chia tốc độ mới là giá theo việc.
ALTER TABLE xv_nguon_model DROP CONSTRAINT IF EXISTS xv_nguon_model_loai_check;
ALTER TABLE xv_nguon_model ADD CONSTRAINT xv_nguon_model_loai_check CHECK (loai IN ('video', 'anh', 'giong', 'am', 'chu', 'nhung', 'gpu'));

INSERT INTO xv_nguon (key, ten, kieu, trang_thai, loai, tra_tien, vault, nap_tien, khoa_env, rui_ro) VALUES
  ('runpod', 'RunPod', 'Máy GPU thuê giờ', 'dang', 'máy GPU', 'Thẻ (trả trước)', '#537', 'https://www.runpod.io/console/user/billing', 'RUNPOD_API_KEY',
   'Community có máy hỏng GPU (Blender không thấy CUDA) — may-thue.sh tự kiểm GPU, hỏng thì xoá thuê máy khác'),
  ('vast', 'Vast.ai', 'Chợ máy GPU', 'tham_khao', 'máy GPU', 'Thẻ / crypto (trả trước)', '', 'https://cloud.vast.ai/billing/', 'VAST_API_KEY',
   'Máy nhà người ta cho thuê: máy rẻ nhất thường chưa xác minh / độ tin cậy thấp; tính tiền theo giây cả lúc máy tắt (đĩa)')
ON CONFLICT (key) DO NOTHING;
-- ckey đã có trong sổ (ảnh) — chỉ thêm loại máy GPU vào mô tả nguồn
UPDATE xv_nguon SET loai = 'ảnh, máy GPU (bán lại Vast)' WHERE key = 'ckey' AND loai NOT LIKE '%GPU%';

INSERT INTO xv_nguon_model (nguon_key, loai, model, goi, gia_vnd, gia_goc, link, ngay_doc, kha_nang, tat) VALUES
  ('runpod', 'gpu', 'RTX 4090', 'Community', 8840, '$0,34 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '24 GB · Cycles ×1,0', ''),
  ('runpod', 'gpu', 'RTX 4090', 'Secure', 23140, '$0,89 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '24 GB · Cycles ×1,0', ''),
  ('runpod', 'gpu', 'RTX 5090', 'Community', 17940, '$0,69 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '32 GB · Cycles ×1,25', ''),
  ('runpod', 'gpu', 'RTX 5090', 'Secure', 30940, '$1,19 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '32 GB · Cycles ×1,25', ''),
  ('runpod', 'gpu', 'RTX 5080', 'Community', 10140, '$0,39 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '16 GB · Cycles ×0,7', '17/10/2026: cấp 3 lần liền cùng một máy 5080 Blender không thấy GPU'),
  ('runpod', 'gpu', 'RTX 5080', 'Secure', 15340, '$0,59 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '16 GB · Cycles ×0,7', ''),
  ('runpod', 'gpu', 'RTX 3090', 'Community', 5720, '$0,22 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '24 GB · Cycles ×0,48', '17/10/2026: máy 3090 Community lỗi cuInit, Blender lặng lẽ render CPU'),
  ('runpod', 'gpu', 'RTX 3090', 'Secure', 13000, '$0,50 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '24 GB · Cycles ×0,48', ''),
  ('runpod', 'gpu', 'L40S', 'Community', 20540, '$0,79 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '48 GB · Cycles ×0,95', ''),
  ('runpod', 'gpu', 'L40S', 'Secure', 28340, '$1,09 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '48 GB · Cycles ×0,95', ''),
  ('runpod', 'gpu', 'H100 SXM', 'Community', 69940, '$2,69 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '80 GB · thẻ huấn luyện, không đáng cho Blender', ''),
  ('runpod', 'gpu', 'H100 SXM', 'Secure', 103740, '$3,99 / giờ', 'https://www.runpod.io/pricing', '2026-10-19', '80 GB · thẻ huấn luyện, không đáng cho Blender', ''),

  ('vast', 'gpu', 'RTX 4090', 'Rẻ nhất', 4880, '$0,188 / giờ · Texas, US', 'https://vast.ai/pricing', '2026-10-19', '24 GB · Cycles ×1,0', 'máy rẻ nhất: độ tin cậy dưới 98 %'),
  ('vast', 'gpu', 'RTX 4090', 'Máy tin cậy', 9070, '$0,349 / giờ · độ tin cậy 99,5 % · Úc (máy xác minh rẻ nhất $0,43)', 'https://vast.ai/pricing', '2026-10-19', '24 GB · Cycles ×1,0', ''),
  ('vast', 'gpu', 'RTX 5090', 'Máy tin cậy', 10770, '$0,414 / giờ · British Columbia, CA (máy xác minh rẻ nhất $0,48)', 'https://vast.ai/pricing', '2026-10-19', '32 GB · Cycles ×1,25', ''),
  ('vast', 'gpu', 'RTX 5080', 'Rẻ nhất', 5260, '$0,202 / giờ · CN', 'https://vast.ai/pricing', '2026-10-19', '16 GB · Cycles ×0,7', 'máy rẻ nhất: độ tin cậy dưới 98 %'),
  ('vast', 'gpu', 'RTX 5080', 'Máy tin cậy', 7980, '$0,307 / giờ · Đài Loan (máy xác minh rẻ nhất $0,31)', 'https://vast.ai/pricing', '2026-10-19', '16 GB · Cycles ×0,7', ''),
  ('vast', 'gpu', 'RTX 3090', 'Máy tin cậy', 3180, '$0,122 / giờ · độ tin cậy 99,3 % · Quebec, CA', 'https://vast.ai/pricing', '2026-10-19', '24 GB · Cycles ×0,48', ''),
  ('vast', 'gpu', 'L40S', 'Rẻ nhất', 11510, '$0,443 / giờ · New York, US', 'https://vast.ai/pricing', '2026-10-19', '48 GB · Cycles ×0,95', 'máy rẻ nhất: độ tin cậy dưới 98 %'),
  ('vast', 'gpu', 'L40S', 'Máy tin cậy', 15640, '$0,601 / giờ · Nhật (máy xác minh)', 'https://vast.ai/pricing', '2026-10-19', '48 GB · Cycles ×0,95', ''),
  ('vast', 'gpu', 'H100 SXM', 'Máy tin cậy', 49980, '$1,922 / giờ · Ấn Độ (máy xác minh rẻ nhất $2,12)', 'https://vast.ai/pricing', '2026-10-19', '80 GB · thẻ huấn luyện, không đáng cho Blender', ''),

  ('ckey', 'gpu', 'RTX 4090', 'Máy tin cậy', 21863, '21.863₫ / giờ · độ tin cậy 99,9 % · US (71 máy)', 'https://ckey.vn/rent-gpu3/', '2026-10-19', '24 GB · Cycles ×1,0', 'bán lại Vast: cùng thẻ trên Vast $0,35 ≈ 9.070₫'),
  ('ckey', 'gpu', 'RTX 5090', 'Rẻ nhất', 26239, '26.239₫ / giờ · độ tin cậy 20 % · UA', 'https://ckey.vn/rent-gpu3/', '2026-10-19', '32 GB · Cycles ×1,25', 'máy độ tin cậy 20 % — dễ đứt giữa lượt'),
  ('ckey', 'gpu', 'RTX 5090', 'Máy tin cậy', 32345, '32.345₫ / giờ · độ tin cậy 99,1 % · RU (63 máy)', 'https://ckey.vn/rent-gpu3/', '2026-10-19', '32 GB · Cycles ×1,25', 'bán lại Vast: cùng thẻ trên Vast $0,41 ≈ 10.770₫'),
  ('ckey', 'gpu', 'RTX 5080', 'Máy tin cậy', 14663, '14.663₫ / giờ · độ tin cậy 99,9 % · RU (55 máy)', 'https://ckey.vn/rent-gpu3/', '2026-10-19', '16 GB · Cycles ×0,7', 'bán lại Vast'),
  ('ckey', 'gpu', 'RTX 3090', 'Máy tin cậy', 9130, '9.130₫ / giờ · độ tin cậy 99,98 % · AR (43 máy)', 'https://ckey.vn/rent-gpu3/', '2026-10-19', '24 GB · Cycles ×0,48', 'bán lại Vast: cùng thẻ trên Vast $0,12 ≈ 3.180₫'),
  ('ckey', 'gpu', 'L40S', 'Máy tin cậy', 31986, '31.986₫ / giờ · JP (1 máy)', 'https://ckey.vn/rent-gpu3/', '2026-10-19', '48 GB · Cycles ×0,95', 'bán lại Vast'),
  ('ckey', 'gpu', 'H100 SXM', 'Máy tin cậy', 250542, '250.542₫ / giờ · US (1 máy)', 'https://ckey.vn/rent-gpu3/', '2026-10-19', '80 GB · thẻ huấn luyện', 'gấp 5 lần Vast cùng thẻ')
ON CONFLICT (nguon_key, loai, model, goi) DO NOTHING;
