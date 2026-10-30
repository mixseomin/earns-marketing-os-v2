-- MÁY ASTROLAS (bước 5 Dạng × Góc × Sản phẩm, anh chọn "Astrolas trước" 30/10/2026): trang chiêm tinh astrolas.com (miễn phí lá số + công cụ; Member $19.99/tháng).
-- Nhóm góc spy #9 "Dịch vụ chiêm tinh · luận giải lá số" (316 góc). Sự thật đã kiểm: apps/xuong-video/su-that/astrolas.md.
-- Nơi đăng: Page cũ "Eyes On Stars" của htuan82 (#632, graph 185974014768613, 475 người theo dõi — tên hợp chiêm tinh, KHÔNG đổi tên),
-- Reel qua Graph API hẹn 19:30 (không dùng br htuan82 cho Astrolas — luật 12/10/2026; đăng + trang điểm Page đều qua Graph). Chưa bật tới khi có video DUYỆT.
INSERT INTO xv_may (ma, ten, du_an, muc_dich, mau, nguon, luat, dang, chay, goc_sp, site_dich, ngach) VALUES (
  'astrolas', 'Astrolas', 'astrolas', 'Free birth chart and professional astrology tools (transits, solar return, synastry, compatibility). Member US$19.99/month. astrolas.com',
  'canh-dong', '{}'::jsonb,
  '["Chỉ dùng sự thật trong su-that/astrolas.md (miễn phí lá số + công cụ; Member US$19.99/tháng, US$167.90/năm; báo cáo lẻ US$4.99)", "Không bịa đánh giá, số người dùng, tên nhà chiêm tinh", "Không hứa trước tương lai chắc chắn — chiêm tinh là tham khảo", "Link đích https://astrolas.com/ (gắn UTM theo nền)"]'::jsonb,
  jsonb_build_array(jsonb_build_object(
    'nen', 'facebook:632', 'ten', 'FB · Eyes On Stars (Astrolas)', 'tk', 'Page Eyes On Stars', 'may', 'iMac', 'tran', 1,
    'kem', 'Page cũ htuan82 #632 · Reel qua Graph API hẹn giờ · link astrolas.com',
    'br', jsonb_build_object('api', true, 'hen', '19:30', 'ten', 'Eyes On Stars', 'acct', '632', 'graph_id', '185974014768613'))),
  false, '{9}', 'astrolas.com', '{san-pham}'
) ON CONFLICT (ma) DO NOTHING;
