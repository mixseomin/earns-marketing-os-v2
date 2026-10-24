-- etp.on.tc tab Tài nguyên (anh 24/10/2026 "etp cần thêm phần quản lý tài nguyên như bộ tk"): tài khoản QC · Page · pixel · tên miền từ Ethopex
-- (dong-bo.py, mỗi lượt 4 lượt gọi). Bộ tài khoản = studio ethopex_bo_tk (tài khoản QC + Page) — trang ghép hai nguồn.
CREATE TABLE IF NOT EXISTS etp.tai_nguyen (
  loai         text NOT NULL,      -- tk_qc | page | pixel | ten_mien
  id           bigint NOT NULL,    -- id Ethopex
  external_id  text,
  ten          text,
  trang_thai   text,
  them         jsonb NOT NULL DEFAULT '{}',   -- account_controls_status, ads_restricted, picture_url, link, available, facebook_bm_id…
  cap_nhat     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (loai, id)
);
