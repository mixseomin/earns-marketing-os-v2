-- HÀNG CHẤM PHẢI TỰ XỬ LỖI (anh 26/10/2026: "Lỗi thì phải có cách xử lý chứ mày cứ để mãi ở đấy?"):
--   lỗi tạm thời (mất mạng, Cloudflare lỗi nội bộ, đường Claude lỗi) → /api/ext/etp-cham tự xếp lại hàng chờ, giãn 5 / 15 / 45 phút, tối đa 3 lần
--   video > 100 MB / không cắt được khung → apps/etp/cham-nhe.py (dong-bo.py gọi mỗi lượt) nén bản xem nhẹ 720p, đẩy vào R2 worker (nhe/<id>.mp4), xếp lại
ALTER TABLE etp.cham_hang ADD COLUMN IF NOT EXISTS lan_thu integer NOT NULL DEFAULT 0;   -- số lần đã tự thử lại vì lỗi tạm thời
ALTER TABLE etp.cham_hang ADD COLUMN IF NOT EXISTS thu_lai_luc timestamptz;              -- chưa tới giờ này thì Worker chưa nhận lại
ALTER TABLE etp.cham_hang ADD COLUMN IF NOT EXISTS lan_nhe integer NOT NULL DEFAULT 0;    -- số lần đã dựng bản xem nhẹ
