-- Thư mục cho bản thiết kế studio2 (anh 20/11/2026: "Phần quản lý file phải chia thành thư mục").
-- thu_muc = đường thư mục dạng 'Ethopex/Tên vàng' ('' = gốc). Bảng xv_thiet_ke_thu_muc giữ cả thư mục còn trống (chưa có bản nào).
ALTER TABLE xv_thiet_ke ADD COLUMN IF NOT EXISTS thu_muc text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS xv_thiet_ke_thu_muc_idx ON xv_thiet_ke (thu_muc) WHERE NOT luu_tru;
CREATE TABLE IF NOT EXISTS xv_thiet_ke_thu_muc (
  duong text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
