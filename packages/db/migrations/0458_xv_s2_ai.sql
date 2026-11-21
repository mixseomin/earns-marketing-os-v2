-- Lịch sử Lệnh AI của Studio 2 theo tập (anh 21/11/2026: mở ở máy khác phải thấy hết lịch sử)
CREATE TABLE IF NOT EXISTS xv_s2_ai (tap_id int PRIMARY KEY, ls jsonb NOT NULL DEFAULT '[]'::jsonb, user_id int, updated_at timestamptz NOT NULL DEFAULT now());
