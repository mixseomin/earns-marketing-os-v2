-- KIỂU CHỮ QC chọn lúc anh duyệt ở etp2 › Camp › Chờ lên (anh 27/11/2026: "Khi duyệt creative thì cũng duyệt cả nội dung text luôn. Sinh kiểu Kiên là default và có option chọn sang Dol").
-- kien = chữ phim trong apps/etp/chu-kieu.json (link search.com) — mặc định · dol = form apps/etp/form-chu.json (info.com).
-- cho_len.py đọc cột này khi nhận bản đã duyệt → chu-qc.py tạo creative mang ĐÚNG chữ anh đã thấy; dong_phim giữ kiểu này (không áp K lên bản anh chọn D).
ALTER TABLE etp.cho_len ADD COLUMN IF NOT EXISTS kieu text NOT NULL DEFAULT 'kien' CHECK (kieu IN ('kien', 'dol'));
