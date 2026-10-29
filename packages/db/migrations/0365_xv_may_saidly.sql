-- MÁY SAIDLY (bước 5, 29/10/2026): app chép lời Windows của Clane, ĐÃ PUBLIC trên Microsoft Store (9P7CRMJ1K765). Nhóm góc spy #1551
-- "Saidly: transcription" (210 góc — đã cào sẵn 28/10). Đích https://clane.app/saidly/. Sự thật: apps/xuong-video/su-that/saidly.md. Chưa kênh, chưa bật.
INSERT INTO xv_may (ma, ten, du_an, muc_dich, mau, nguon, luat, dang, chay, goc_sp, site_dich, ngach) VALUES (
  'saidly', 'Saidly', 'clane', 'Transcription for Windows that runs on your own PC (Whisper), nothing uploaded; TXT/SRT/VTT export. 7-day free trial, then US$14.99 once. clane.app/saidly',
  'canh-dong', '{}'::jsonb,
  '["Chỉ dùng sự thật trong su-that/saidly.md (US$14.99 trả một lần, dùng thử 7 ngày, Windows 10/11, chạy trên máy, không tải lên)", "Không bịa đánh giá, số người dùng, độ chính xác %", "Link đích https://clane.app/saidly/ (gắn UTM theo nền)"]'::jsonb,
  '[]'::jsonb, false, '{1551}', 'clane.app/saidly', '{san-pham}'
) ON CONFLICT (ma) DO NOTHING;
