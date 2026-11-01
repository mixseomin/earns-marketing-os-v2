-- Kết luận tự chấm của lượt viết kịch bản (apps/xuong-video so-tay-kich-ban.ts › ChamKb): điểm, phép thử, chấm ngược, gag chọn / loại.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS cham_kich_ban jsonb;
