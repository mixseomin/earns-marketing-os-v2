-- BỘ SET 3D (14/10/2026, anh: "giải pháp kỹ thuật tuyệt đối về bối cảnh và bố trí đồ đạc" · "sau này sẽ tạo thêm nhiều bối cảnh khác nhau").
-- Kho bộ set theo dự án (một set dùng cho nhiều phim): du_lieu = { vat: [{ ten, hinh, tam, co, mau, xoay?, goc?/phan? , anchor? }] } toạ độ cm,
-- gốc = giữa mép trước, x phải, y vào sâu, z lên. Anchor bối cảnh trỏ vào set + VÙNG trong set; nhân vật / đạo cụ có khối đại diện 3D.
-- Shot: may_3d = máy ảo + vị trí nhân vật (đầu vào); khung_xam = render khung xám + bản đồ độ sâu + kiểm hình học (đầu ra, gắn mã đầu vào).
CREATE TABLE IF NOT EXISTS xv_bo_set (
  id serial PRIMARY KEY,
  project text NOT NULL DEFAULT 'studio',
  phim_id int NULL,
  ten text NOT NULL,
  mo_ta text NOT NULL DEFAULT '',
  du_lieu jsonb NOT NULL DEFAULT '{"vat":[]}'::jsonb,
  mat_bang_url text NULL,
  trang_thai text NOT NULL DEFAULT 'nhap',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS bo_set_id int NULL;
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS vung jsonb NULL;
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS khoi_3d jsonb NULL;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS may_3d jsonb NULL;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS khung_xam jsonb NULL;
