-- PAGE SIDECUE (anh chọn "Page mới Sidecue" 29/10/2026): tạo trên htuan82, graph 1309030612304090 (profile.php?id=61595672356087), website clane.app/sidecue,
-- ảnh đại diện + bìa ảnh thật đặt qua Graph (trang-diem-page.mts, --kiem đạt). Ghi vào kho tài khoản rồi gắn làm kênh facebook:<id> của máy sidecue
-- (Reel qua Graph API hẹn 18:00). Page mới: máy chỉ hẹn dài sau khi có bài lên thật (henKenh). Bật máy sidecue khi có video DUYỆT.
WITH tk AS (
  INSERT INTO platform_accounts (tenant_id, platform_key, handle, status, category, persona_kind, account_kind, account_type, notes)
  SELECT 'self', 'facebook', 'Sidecue (Page)', 'active', 'social', 'brand', 'page', 'brand',
         'Fanpage tạo 29/10/2026 cho máy sidecue (bước 5), graph 1309030612304090, quản bởi htuan82'
  WHERE NOT EXISTS (SELECT 1 FROM platform_accounts WHERE handle = 'Sidecue (Page)' AND platform_key = 'facebook')
  RETURNING id
)
UPDATE xv_may SET dang = dang || jsonb_build_array(jsonb_build_object(
  'nen', 'facebook:' || tk.id, 'ten', 'FB · Sidecue', 'tk', 'Page Sidecue', 'may', 'iMac', 'tran', 1,
  'kem', 'Page mới 29/10 · Reel qua Graph API hẹn giờ · link clane.app/sidecue',
  'br', jsonb_build_object('api', true, 'hen', '18:00', 'ten', 'Sidecue', 'acct', tk.id::text, 'dung', '411',
    'profile', '/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-htuan82', 'graph_id', '1309030612304090')))
FROM tk WHERE xv_may.ma = 'sidecue';
