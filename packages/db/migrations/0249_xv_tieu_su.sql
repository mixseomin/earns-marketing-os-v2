-- Tiểu sử nhân vật (anh 14/10/2026 — "mỗi con nên có tiểu sử để sau làm phim về tiểu sử của chúng, giống Marvel"): nguồn gốc, tính cách,
-- sức mạnh, điểm yếu, mong muốn, nỗi sợ, quan hệ, bí mật. Tách khỏi mo_ta (đặc tính NHÌN THẤY, đi vào prompt ảnh/video); tiểu sử chỉ vào
-- ngữ cảnh khi Claude viết kịch bản / tách cảnh.
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS tieu_su text NOT NULL DEFAULT '';
