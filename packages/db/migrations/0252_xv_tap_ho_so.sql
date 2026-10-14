-- Hồ sơ tiền kỳ chuẩn studio (14/10/2026): phần cấp TẬP của 7 tài liệu — thời gian, đường đi, motif, cung cảm xúc (kieu.ts › TapHoSo).
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS ho_so jsonb NOT NULL DEFAULT '{}'::jsonb;
