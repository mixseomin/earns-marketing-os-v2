-- MÁY SIDECUE (bước 5 Dạng × Góc × Sản phẩm, anh chọn 29/10/2026): app teleprompter Windows của Clane, ĐÃ PUBLIC trên Microsoft Store (9MZZKHK46VZP) —
-- luật bước 5: app chưa public thì không dựng máy. Nhóm góc spy #842 (Teleprompter, 384 góc). Đích: https://clane.app/sidecue/. Sự thật đã kiểm:
-- apps/xuong-video/su-that/sidecue.md. Nơi đăng để trống tới khi lập kênh; chưa bật.
INSERT INTO xv_may (ma, ten, du_an, muc_dich, mau, nguon, luat, dang, chay, goc_sp, site_dich, ngach) VALUES (
  'sidecue', 'Sidecue', 'clane', 'Teleprompter for video calls on Windows: script under the webcam, hidden from screen share, phone remote. 7-day free trial, then US$7.99 once. clane.app/sidecue',
  'canh-dong', '{}'::jsonb,
  '["Chỉ dùng sự thật trong su-that/sidecue.md (giá US$7.99 trả một lần, dùng thử 7 ngày, Windows 10/11)", "Không bịa đánh giá, số người dùng", "Link đích https://clane.app/sidecue/ (gắn UTM theo nền)"]'::jsonb,
  '[]'::jsonb, false, '{842}', 'clane.app/sidecue', '{san-pham}'
) ON CONFLICT (ma) DO NOTHING;
