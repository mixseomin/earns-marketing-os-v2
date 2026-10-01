-- SHOP — toàn văn bài quảng cáo đối thủ (hook chỉ là câu mở đầu; anh cần "mọi thứ cụ thể" để soạn QC — 02/10/2026).
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS noi_dung text;   -- toàn văn primary text, chép nguyên
ALTER TABLE shop_doi_thu_qc ADD COLUMN IF NOT EXISTS mo_ta text;      -- dòng mô tả dưới tiêu đề (link description)
