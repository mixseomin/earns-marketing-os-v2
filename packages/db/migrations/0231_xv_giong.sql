-- Giọng cố định của mỗi nhân vật cho cả bộ phim (model + voice của model đó) + file nghe thử. 08/10/2026.
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS giong_model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS giong_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS giong_mau_url text;
-- Nhạc nền theo TỪNG PHÂN CẢNH (anh 08/10/2026: "nhạc nền cũng phải sinh riêng theo từng phân đoạn"): { "<tên phân cảnh>": "<url>" }.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS nhac_phan_canh jsonb NOT NULL DEFAULT '{}'::jsonb;
