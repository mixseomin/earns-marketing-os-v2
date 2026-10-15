-- Nguồn tham khảo của từng câu chữ màn / lời trong shot (apps/xuong-video › tham-khao.ts): QC bắt buộc, cổng chặn câu không có nguồn.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS tham_khao jsonb NOT NULL DEFAULT '[]'::jsonb;
