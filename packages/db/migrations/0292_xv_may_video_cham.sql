-- Phòng Nội dung chấm BÀI ĐĂNG social (anh 18/10/2026: "thêm bộ chấm điểm… để bài nào, nội dung nào đăng lên cũng phải hấp dẫn được người đọc").
-- apps/cty/worker/cham-dang.mjs ghi kết quả vào đây; máy đăng (puzzle-books dang-may.mjs) chỉ lấy video có cham.ket = 'DUYET' và cham.xuat = xuat_luc
-- (xuất lại video = chấm lại). Chuẩn: apps/cty/cong-ty/quy-dinh/noi-dung/chuan-bai-dang.md.
ALTER TABLE xv_may_video ADD COLUMN IF NOT EXISTS cham jsonb;
