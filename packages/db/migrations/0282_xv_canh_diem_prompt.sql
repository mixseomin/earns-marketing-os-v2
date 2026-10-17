-- Điểm prompt từng shot (apps/xuong-video kiem-prompt.ts): {diem, diem_video, loi:[{buoc, ma, phat, chu}], luc} — hiện trên timeline, ghi mỗi lượt cổng / dựng 3D.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS diem_prompt jsonb;
