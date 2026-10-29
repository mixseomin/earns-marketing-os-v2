-- SAIDLY lên Page chung của Clane (anh chọn "Page Clane chung" 29/10/2026): Page #678 (graph 1309030612304090, đang tên Sidecue, đã gửi đổi tên → Clane).
-- Hẹn 20:30 (Sidecue 18:00 trên cùng Page — nhịp an toàn giữ cách ≥ 3 giờ + trần theo tài khoản #678 gộp cả hai máy).
-- br.ten = tên Page HIỆN TẠI (kiemTrang so tên): Facebook duyệt "Clane" thì đổi ten ở cả máy sidecue lẫn saidly.
UPDATE xv_may SET dang = dang || jsonb_build_array(jsonb_build_object(
  'nen', 'facebook:678', 'ten', 'FB · Clane (Saidly)', 'tk', 'Page Clane (#678)', 'may', 'iMac', 'tran', 1,
  'kem', 'Page chung Clane · Reel qua Graph API hẹn giờ · link clane.app/saidly',
  'br', jsonb_build_object('api', true, 'hen', '20:30', 'ten', 'Sidecue', 'acct', '678', 'dung', '411',
    'profile', '/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-htuan82', 'graph_id', '1309030612304090')))
WHERE ma = 'saidly' AND NOT dang @> '[{"nen":"facebook:678"}]';
