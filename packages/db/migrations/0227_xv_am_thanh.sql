-- Timeline kiểu CapCut (08/10/2026): ngoài track hình, mỗi tập có track Thoại · Âm thanh · Nhạc. Chỗ chứa file đã sinh:
-- thoai_url = giọng đọc lời thoại của cảnh (TTS theo giọng anchor), am_thanh_url = hiệu ứng/âm nền của cảnh, nhac_url = nhạc nền cả tập.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS thoai_url text, ADD COLUMN IF NOT EXISTS am_thanh_url text;
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS nhac_url text, ADD COLUMN IF NOT EXISTS nhac_mo_ta text NOT NULL DEFAULT '';
