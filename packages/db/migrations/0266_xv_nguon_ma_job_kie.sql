-- Sổ nguồn AI: nối dòng Kie.ai / WaveSpeedAI với lượt chạy thật (xv_job provider|model) — studio đã có đường gọi hai cổng này (cong-ai.ts, 16/10/2026),
-- để cột Ổn định + Đã trừ tự có số khi bắt đầu chạy.
UPDATE xv_nguon_model SET ma_job = '{kie|veo3_lite}' WHERE nguon_key = 'kie' AND model = 'Veo 3.1 Lite' AND cardinality(ma_job) = 0;
UPDATE xv_nguon_model SET ma_job = '{kie|veo3_fast}' WHERE nguon_key = 'kie' AND model = 'Veo 3.1 Fast' AND cardinality(ma_job) = 0;
UPDATE xv_nguon_model SET ma_job = '{wavespeed|kwaivgi/kling-v3.0-std/image-to-video}' WHERE nguon_key = 'wavespeed' AND model = 'Kling 3.0 Std' AND cardinality(ma_job) = 0;
UPDATE xv_nguon SET rui_ro = rui_ro || CASE WHEN rui_ro = '' THEN '' ELSE ' · ' END || 'Studio đã có đường gọi — đặt khoá trên box là chạy' WHERE key IN ('kie', 'wavespeed');
