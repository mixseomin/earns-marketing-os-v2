-- Thẻ shot trước keyframe (14/10/2026): bố cục 3 lớp, trạng thái mở/kết, hướng nhìn/hướng đi, mục đích cảm xúc, motif/gài — kieu.ts › DanDung.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS dan_dung jsonb NOT NULL DEFAULT '{}'::jsonb;
