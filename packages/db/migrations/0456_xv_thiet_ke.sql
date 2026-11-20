-- Công cụ thiết kế creative tĩnh của Studio 2 (studio2.on.tc/thiet-ke.html), anh 20/11/2026 "Thiết kế vẫn làm".
-- Mỗi dòng = một bản thiết kế: khung (rộng × cao) + các lớp Fabric.js (du_lieu) + ảnh xem nhỏ. ma_mau = mã mẫu creative etp (dt_*, free_*…) nếu bản này dựng cho mẫu đó.
-- Không xoá: cất đi bằng luu_tru = true.
CREATE TABLE IF NOT EXISTS xv_thiet_ke (
  id serial PRIMARY KEY,
  ten text NOT NULL,
  ma_mau text,
  rong int NOT NULL,
  cao int NOT NULL,
  du_lieu jsonb NOT NULL,
  anh_xem text,
  user_id int,
  luu_tru boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_thiet_ke_mau_idx ON xv_thiet_ke (ma_mau) WHERE NOT luu_tru;
