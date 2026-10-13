-- Bộ ÂM HIỆU của nhân vật (phim không lời — Tango & Lint, 14/10/2026): mỗi con một bộ âm cố định (đặc trưng, vui, sợ…) làm MỘT lần, tập nào
-- cũng dùng lại cùng file → khán giả nghe là nhận ra (như "pika" của Pikachu). [{ ten, mo_ta, url }]
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS am_hieu jsonb NOT NULL DEFAULT '[]'::jsonb;
