-- Mạch nháp → bản cuối (anh duyệt 08/10/2026): video_url = bản NHÁP (model rẻ), video_cuoi_url = bản cuối (nâng cấp chính clip nháp
-- → khớp 100%, hoặc sinh lại model cao cùng khung đầu/cuối). nguon_video = đủ thứ để tái lập: model, prompt, khung đầu, khung cuối, seed.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS video_cuoi_url text;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS nguon_video jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Nối cảnh: khung cuối của cảnh = keyframe cảnh sau → các clip ghép liền mạch.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS noi_khung boolean NOT NULL DEFAULT false;
