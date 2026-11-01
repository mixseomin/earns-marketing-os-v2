-- CÁCH DỰNG "NỀN CỐ ĐỊNH + LỚP NHÂN VẬT" (anh 01/11/2026, MV gag kiểu Englishman in New York: "mỗi gag là 1 khung có nền cố định, nhân vật độc lập và cử động khác"):
--   xv_nhan_vat.do_mang : đồ nhân vật LUÔN mang theo (tiếng Anh) — mọi prompt ảnh / video đọc, đồ không biến mất giữa clip
--   xv_nhan_vat.nen     : tấm nền cố định của anchor bối cảnh theo góc máy { "<khoá góc>": url }
--   xv_canh.lop         : { nen: url, anh: { "<url ảnh ghép>": "<url ảnh lớp nền xanh>" }, video_tho: url }
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS do_mang text NOT NULL DEFAULT '';
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS nen jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS lop jsonb;
