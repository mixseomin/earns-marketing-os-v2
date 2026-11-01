-- SHOT CODE (anh 01/11/2026 "làm B3 luôn"): lớp hình của video máy dựng bằng trang HTML trên iMac (apps/xuong-video/scripts/shot-code/),
-- box3 chỉ ghép tiếng + cắt khung. Cột riêng, KHÔNG nằm trong `de` — napVideo so `de` để biết đề đổi, ghi vào đó thì mỗi lần nạp lại là xoá video.
-- { cho: true } = đang chờ iMac dựng · { url, phien, de_md5 } = bản đã dựng cho đúng đề + phiên trang (lệch là dựng lại).
ALTER TABLE xv_may_video ADD COLUMN IF NOT EXISTS hinh_code jsonb;
