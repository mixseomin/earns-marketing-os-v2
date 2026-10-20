-- Khoá đăng nhập dịch vụ ngoài cho studio (xuong-video) gọi API server-side — vd Ethopex (access_token + refresh_token, tự gia hạn).
-- Không in ra giao diện; chỉ actions server đọc/ghi.
CREATE TABLE IF NOT EXISTS xv_khoa_ngoai (
  ten text PRIMARY KEY,
  gia_tri jsonb NOT NULL DEFAULT '{}'::jsonb,
  cap_nhat timestamptz NOT NULL DEFAULT now()
);
