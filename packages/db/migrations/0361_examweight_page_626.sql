-- ExamWeight vào máy đăng (bước 5 Dạng × Góc × Sản phẩm, 29/10/2026): Page htuan82 "Trust Reviews" (#626, graph 537626083113751) — Facebook chặn đổi tên
-- khi Page chưa có hoạt động, anh chọn giữ tên, đăng bài thật trước rồi đổi tên sau. Ảnh đại diện + ảnh bìa NREMT đã đặt (trang-diem-page.mts, --kiem đạt).
-- Reel qua Graph API hẹn 19:00 (giờ trống, không trùng 608/625/607). Luật Page mới trong henKenh: chưa có bài thật thì không hẹn dài.
UPDATE xv_may SET chay = true, dang = dang || jsonb_build_array(jsonb_build_object(
  'nen', 'facebook:626', 'ten', 'FB · Trust Reviews (ExamWeight)', 'tk', 'Page Trust Reviews', 'may', 'iMac', 'tran', 1,
  'kem', 'Page htuan82 #626 · câu hỏi NREMT · Reel qua Graph API hẹn giờ',
  'br', jsonb_build_object('api', true, 'hen', '19:00', 'ten', 'Trust Reviews', 'acct', '626', 'dung', '411',
    'profile', '/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-htuan82', 'graph_id', '537626083113751')))
WHERE ma = 'examweight-cau-hoi' AND NOT dang @> '[{"nen":"facebook:626"}]';
