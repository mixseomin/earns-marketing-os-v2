-- Máy thứ hai (anh duyệt plan social traffic 17/10/2026): ngách ĐẶT PHÒNG KHÁCH SẠN → ratesbyroom.com, mẫu "Scam or Real?" (0đ, máy dựng),
-- nguồn đề = kịch bản tin nhắn lừa đảo / thật từ góc spy #21054 "Lừa đảo và phishing giả mạo khách sạn" (apps/xuong-video/mau/may/scam-or-real.json).
-- Nơi đăng để trống tới khi mở bộ kênh của ngách; chưa bật (chay = false).
INSERT INTO xv_may (ma, ten, du_an, muc_dich, mau, nguon, luat, dang, chay) VALUES (
  'ratesbyroom-scam-or-real', 'Scam or Real? · tin nhắn khách sạn', 'adfond', 'Đặt phòng khách sạn · ratesbyroom.com', 'scam-or-real',
  '{"mo_ta": "Kịch bản tin nhắn lừa đảo / thật (góc spy #21054 Lừa đảo và phishing giả mạo khách sạn)", "dung": 0, "tong": 30}'::jsonb,
  '["Xoay kênh WhatsApp / Email / SMS", "Cứ 4 tin lừa đảo xen 1 tin thật", "Mỗi chiêu lừa một video, không lặp chiêu trong 7 ngày"]'::jsonb,
  '[]'::jsonb, false
) ON CONFLICT (ma) DO NOTHING;
