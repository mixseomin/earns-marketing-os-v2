-- Ảnh SÁT MẶT của nhân vật (16/10/2026, phim người thật): máy cắt từ ảnh mẫu (scripts/soi-mat) — kèm vào lượt sinh keyframe / sửa mặt để mô hình
-- bám đúng mặt. {tu: mã các ảnh mẫu lúc cắt (đổi ảnh mẫu → cắt lại), url: [ảnh mặt điển hình, ảnh mặt khác góc]}
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS anh_mat jsonb;
