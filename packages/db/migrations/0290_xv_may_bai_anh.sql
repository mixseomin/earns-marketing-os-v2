-- Dạng nội dung "bài ảnh" mở rộng (18/10/2026, anh: "thêm dạng nội dung khác để đăng lên"): ảnh tĩnh cắt từ video (xv_may_video.anh)
--   · fb_anh: bài album ảnh trên Page FB qua Graph API (dang-fb-reel.mts chế độ anh) — cả Hotel Scam Alerts lẫn Before You Land
--   · x_anh: Before You Land cũng có bài ảnh trên X (Hotel đã có từ 0288)
UPDATE xv_may SET dang = dang || '[{"nen": "fb_anh", "ten": "Facebook · bài ảnh", "tk": "Page Hotel Scam Alerts", "may": "iMac", "gio": "20:00", "tran": 1,
  "kem": "album 2 ảnh câu đố + đáp án, link ratesbyroom.com trong bài · Graph API (box3)", "br": {"acct": "544", "ten": "Hotel Scam Alerts", "graph_id": "1357352200797299"}}]'::jsonb
WHERE ma = 'ratesbyroom-scam-or-real' AND NOT dang @> '[{"nen": "fb_anh"}]';
UPDATE xv_may SET dang = dang || '[{"nen": "fb_anh", "ten": "Facebook · bài ảnh", "tk": "Page Before You Land", "may": "iMac", "gio": "20:00", "tran": 1,
  "kem": "album 2 ảnh sân bay + 3 bước, link esimfares.com trong bài · Graph API (box3)", "br": {"acct": "549", "ten": "Before You Land", "graph_id": "1390426090820893"}},
  {"nen": "x_anh", "ten": "X · bài ảnh", "tk": "@beforeyouland", "may": "iMac", "gio": "20:00", "tran": 1, "kem": "2 ảnh sân bay + 3 bước, link esimfares.com trong bài",
  "br": {"acct": "546", "handle": "@beforeyouland", "profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-beforeyouland"}}]'::jsonb
WHERE ma = 'esimfares-before-you-land' AND NOT dang @> '[{"nen": "fb_anh"}]';
