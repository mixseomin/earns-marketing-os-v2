-- Ô kế hoạch tuần ghi thêm MÃ DẠNG (kho scripts/ke-hoach-goc/dang-bai.json) bên cạnh tên format (bước 2 Dạng × Góc × Sản phẩm, 26/10/2026):
-- xoay dạng 14 ngày và đo theo dạng (bước 7) đếm theo mã, không theo chữ. Ô cũ (bảng xoay cứng) để NULL.
ALTER TABLE ke_hoach_goc ADD COLUMN IF NOT EXISTS dang text;
CREATE INDEX IF NOT EXISTS ke_hoach_goc_may_ho_ngay_idx ON ke_hoach_goc (may, ho, ngay);
