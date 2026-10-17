-- Bộ kênh "Before You Land" cho máy eSIM (roadmap S02 bước 3–4, 18/10/2026) + BẬT máy. Kênh:
--   YouTube @beforeyouland — kênh trống Mstory của Gmail doanhedu đổi tên (makalyn đủ 2 kênh, kênh thứ 3 đòi xác minh mặt). Phiên doanhedu
--     hiện chỉ ở MacBook → may=MacBook (lượt MacBook:com.earns.may-dang); đăng nhập doanhedu trên iMac xong thì đổi sang iMac.
--   Facebook Page Before You Land — htuan82 tạo, đăng Reels qua Graph API box3 (app Kenh Social Poster đã opt-in mọi Page).
--   X @beforeyouland — tài khoản anh đưa (LaceyTowne4ups đổi tên), profile beforeyouland đi trọn proxy #4 (Webshare US).
UPDATE xv_may SET chay = true, dang = '[
  {"nen": "youtube", "ten": "YouTube Shorts", "tk": "@beforeyouland", "may": "MacBook", "gio": "20:40", "tran": 1, "kem": "link esimfares.com trong mô tả + bình luận",
   "br": {"profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-doanhedu", "acct": "547", "handle": "@beforeyouland", "kenh_id": "UCipptBSL_Uxfh_aocuBDXpA"}},
  {"nen": "facebook", "ten": "Facebook Reels", "tk": "Page Before You Land", "may": "iMac", "gio": "20:00", "tran": 1, "kem": "link esimfares.com trong mô tả · đăng qua Graph API (box3)",
   "br": {"api": true, "acct": "549", "ten": "Before You Land", "graph_id": "1390426090820893", "page_id": "1390426090820893", "profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-htuan82"}},
  {"nen": "x", "ten": "X", "tk": "@beforeyouland", "may": "iMac", "gio": "20:00", "tran": 1, "kem": "link esimfares.com ngay trong bài",
   "br": {"profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-beforeyouland", "acct": "546", "handle": "@beforeyouland"}}
]'::jsonb WHERE ma = 'esimfares-before-you-land';
