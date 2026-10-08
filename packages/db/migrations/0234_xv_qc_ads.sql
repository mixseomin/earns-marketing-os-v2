-- Quảng cáo đúng nghề (review phim bra 09/10/2026, dùng chung cho mọi sản phẩm):
--   phat_s   : số giây THỰC PHÁT của shot trong bản dựng (cắt từ đầu clip). Clip AI chỉ sinh được 4/6/8s nhưng quảng cáo cần shot 1,5–3s;
--              trước đây thoi_luong_s vừa là độ dài sinh vừa là độ dài phát nên brief 24s tách ra 64s.
--   chu_man  : chữ hiện trên màn của shot (hook, số liệu, ưu đãi, CTA) — 85% người xem Meta tắt tiếng.
--   nhanh    : '' = thân chung; 'A'/'B'/'C' = biến thể hook (cùng một thân, nhiều hook để A/B trên Meta/TikTok).
--   doi_chieu: kết quả Claude nhìn ảnh anchor so với mô tả (ảnh sản phẩm có ren mà mô tả ghi "không ren" → cả kịch bản khoe tính năng không có).
--   thoi_luong_s (tập): thời lượng mục tiêu, để tách cảnh và bộ kiểm quảng cáo cùng đọc một số.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS phat_s numeric;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS chu_man text NOT NULL DEFAULT '';
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS nhanh text NOT NULL DEFAULT '';
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS doi_chieu jsonb;
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS thoi_luong_s integer;
