-- KÊNH YOUTUBE EXAMWEIGHT (anh chọn 29/10/2026 "Đổi tên kênh trống 'zonnie' (htuan82)" — tạo kênh mới bị YouTube đòi xác minh số điện thoại):
-- kênh UCKI2DpejAq2LiGkWFaMYB-w (htuan82, 0 người đăng ký) đổi thành ExamWeight @examweight, ảnh đại diện + ảnh bìa ảnh thật, mô tả có link examweight.com.
-- Ghi vào kho tài khoản (profile htuan82 #24, iMac) rồi gắn làm kênh youtube của máy examweight-cau-hoi: Shorts đăng 21:00 giờ VN (10:00 sáng miền Đông Mỹ).
WITH tk AS (
  INSERT INTO platform_accounts (tenant_id, platform_key, handle, status, category, persona_kind, account_kind, account_type, browser_profile_id, notes)
  SELECT 'self', 'youtube', '@examweight', 'active', 'general', 'brand', 'user', 'brand', 24,
         'Kênh YouTube ExamWeight (UCKI2DpejAq2LiGkWFaMYB-w), đổi tên từ kênh trống zonnie của htuan82 29/10/2026 — ôn thi NREMT/PTCB/TEAS → examweight.com. Đăng: Studio của đúng mã kênh.'
  WHERE NOT EXISTS (SELECT 1 FROM platform_accounts WHERE handle = '@examweight' AND platform_key = 'youtube')
  RETURNING id
)
UPDATE xv_may SET dang = dang || jsonb_build_array(jsonb_build_object(
  'nen', 'youtube', 'ten', 'YouTube Shorts', 'tk', '@examweight', 'may', 'iMac', 'tran', 1, 'gio', '21:00',
  'kem', 'link examweight.com trong mô tả',
  'br', jsonb_build_object('acct', tk.id::text, 'handle', '@examweight', 'kenh_id', 'UCKI2DpejAq2LiGkWFaMYB-w',
    'profile', '/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-htuan82')))
FROM tk WHERE xv_may.ma = 'examweight-cau-hoi' AND NOT (xv_may.dang @> '[{"nen":"youtube"}]');
