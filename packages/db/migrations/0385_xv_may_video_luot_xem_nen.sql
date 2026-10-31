-- Lượt xem TỪNG NỀN (YouTube trang công khai, Facebook Graph views) — luot_xem = tổng, dùng xét video thắng cho cả máy chỉ đăng Facebook (31/10/2026).
ALTER TABLE xv_may_video ADD COLUMN IF NOT EXISTS luot_xem_nen jsonb NOT NULL DEFAULT '{}';
