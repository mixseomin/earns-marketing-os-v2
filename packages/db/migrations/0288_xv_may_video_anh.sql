-- Ảnh tĩnh của video máy (18/10/2026, roadmap S02 bước 5): mẫu khai `anh` (mau-dung.ts) → lúc dựng cắt thêm ảnh từ MP4 (scam: câu đố + đáp án)
-- cho bài ảnh — nền "x_anh" của máy đăng (X đăng 2 ảnh). Video dựng trước đó bù bằng `may-dung.mts --anh all-chua`.
ALTER TABLE xv_may_video ADD COLUMN IF NOT EXISTS anh jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Nền x_anh cho máy Hotel Scam Alerts: cùng tài khoản X @hotelscamalerts (#540, profile webshare-us), mỗi ngày 1 bài 2 ảnh (câu đố + đáp án) ngoài bài video.
UPDATE xv_may SET dang = dang || '[{"nen": "x_anh", "ten": "X · bài ảnh", "tk": "@hotelscamalerts", "may": "iMac", "gio": "20:00", "tran": 1,
  "kem": "2 ảnh câu đố + đáp án, link ratesbyroom.com trong bài",
  "br": {"acct": "540", "handle": "@hotelscamalerts", "profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-webshare-us"}}]'::jsonb
WHERE ma = 'ratesbyroom-scam-or-real' AND NOT dang @> '[{"nen": "x_anh"}]';
