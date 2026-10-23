-- PHÂN CẢNH VẼ theo từng cảnh của tập (apps/xuong-video/scripts/bang-gom.mts + so-do-canh.ts): đi từ tổng quan xuống chi tiết — tờ phác bố trí máy vẽ
-- từ sơ đồ cảnh · thumbnail cả cảnh (AI) · bảng khối · (keyframe từng shot nằm ở xv_canh). Tab Storyboard › 🎬 Phân cảnh đọc cột này.
-- Mỗi phần tử: { phan_doan, phac?, t1?, khoi?: [{ tu, den, url }], luc }.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS phan_canh_ve jsonb NOT NULL DEFAULT '[]'::jsonb;
