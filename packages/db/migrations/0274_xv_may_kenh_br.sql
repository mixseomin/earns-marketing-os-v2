-- Cấu hình kênh cho máy đăng (puzzle-books scripts/dang-br.mjs, 17/10/2026): xv_may.dang[].br = { profile, acct, page_id?, ten?, handle?, kenh_id? }.
-- Trước đó profile / id vault / Page gắn cứng trong dang-short.mjs nên chỉ Front Porch đăng được. kenh_id: một Gmail có nhiều kênh YouTube —
-- máy đăng kiểm đúng kênh trong Studio trước khi tải lên (không đăng nhầm kênh khác cùng Gmail).
UPDATE xv_may SET dang = '[
  {"nen": "tiktok", "ten": "TikTok", "tk": "@uriellrqv5g", "may": "iMac", "gio": "20:00", "tran": 1, "kem": "mã TT20"},
  {"nen": "youtube", "ten": "YouTube Shorts", "tk": "@frontporchpuzzles", "may": "MacBook", "gio": "20:05", "tran": 1, "kem": "bình luận link đáp án + mã YT20",
   "br": {"profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-militarycalc", "acct": "506", "handle": "@frontporchpuzzles", "kenh_id": "UCdiiPLg90zc6VeVK0RTev3g"}},
  {"nen": "facebook", "ten": "Facebook Reels", "tk": "Page Front Porch Puzzles", "may": "MacBook", "gio": "20:05", "tran": 1, "kem": "mã FB20",
   "br": {"profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-doanhedu", "acct": "507", "page_id": "61594919229334", "ten": "Front Porch Puzzles"}},
  {"nen": "instagram", "ten": "Instagram Reels", "tk": "@frontporchpuzzles", "may": "MacBook", "gio": "20:05", "tran": 1, "kem": "mã IG20",
   "br": {"profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-militarycalc", "acct": "508", "handle": "@frontporchpuzzles"}}
]'::jsonb WHERE ma = 'front-porch-only-one';

UPDATE xv_may SET dang = '[
  {"nen": "youtube", "ten": "YouTube Shorts", "tk": "@hotelscamalerts", "may": "MacBook", "gio": "20:05", "tran": 1, "kem": "link ratesbyroom.com trong mô tả + bình luận",
   "br": {"profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-militarycalc", "acct": "543", "handle": "@hotelscamalerts", "kenh_id": "UC14JGVO0K609bftALd4cNxA"}},
  {"nen": "facebook", "ten": "Facebook Reels", "tk": "Page Hotel Scam Alerts", "may": "MacBook", "gio": "20:05", "tran": 1, "kem": "link ratesbyroom.com trong bình luận",
   "br": {"profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-doanhedu", "acct": "544", "page_id": "61595413023816", "ten": "Hotel Scam Alerts"}},
  {"nen": "x", "ten": "X", "tk": "@hotelscamalerts", "may": "iMac", "gio": "20:05", "tran": 1, "kem": "link ratesbyroom.com ngay trong bài",
   "br": {"profile": "/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-webshare-us", "acct": "540", "handle": "@hotelscamalerts"}}
]'::jsonb WHERE ma = 'ratesbyroom-scam-or-real';

-- Chữ đăng mẫu scam bỏ gạch ngang dài (luật human-voice cho nội dung public) — cùng sửa ở may-dung-scam.ts › kichBanScam.
UPDATE xv_may_video v SET dang = replace(replace(v.dang::text, ' – call the hotel', '. Call the hotel'), ' – spot the red flags', ': spot the red flags')::jsonb
FROM xv_may m WHERE m.id = v.may_id AND m.ma = 'ratesbyroom-scam-or-real';
