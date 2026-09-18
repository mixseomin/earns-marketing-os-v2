-- Nạp trạng thái phủ ban đầu cho chatwhenbored.com (project chatwhenbored trên MOS2 (tách khỏi adfond 18/09/2026)) — 14/09/2026.
-- Chạy một lần sau migration 0180: psql "$DATABASE_URL" -f scripts/phu/seed-chatwhenbored.sql
INSERT INTO phu_platforms (project_id, slug, name, nhom, chuong_trinh, trang_thai, hoa_hong, link_mau, cua_ra, account_id, card_id, buoc_ke, ghi_chu) VALUES
('chatwhenbored','chaturbate','Chaturbate','cam','chaturbate','da_cam','20% revshare trọn đời + $50/broadcaster + 5% referred','https://chaturbate.com/in/?tour=grq0&campaign=IGlGw&track=chatwhenbored&sid={SUBID}','/r/',NULL,NULL,'Đặt track riêng cho lander live.* (track=live đã có trên link phòng)','Tài khoản zoomxxx (Directus), campaign IGlGw. Stats API chỉ tổng theo ngày.'),
('chatwhenbored','livejasmin','LiveJasmin','cam','awempire','da_cam','35–45% revshare lifetime, PPS tới $300','https://ctwmsg.com/?performerName=&siteId=jasmin&categoryName=&pageName=home&prm[psid]=mikerey887&prm[pstool]=205_1&prm[psprogram]=revs&prm[campaign_id]=&subAffId={SUBID}','/go/livejasmin/',451,926,'Anh: KYC AWEmpire (ID + ảnh giấy tờ) — không KYC không rút tiền','Confirm email + link Promo Tools xong 14/09'),
('chatwhenbored','jerkmate','Jerkmate','cam','crakrevenue','da_cam','30% revshare lifetime (exclusive) · PPS $40 (8780)','https://t.ajrkmx3.com/423371/6224/0?po=6533&aff_sub5=SF_006OG000004lmDN&aff_sub={SUBID}','/go/jerkmate/',447,918,'Anh: billing/KYC CrakRevenue khi đạt $1','Offer 6224 approved 14/09'),
('chatwhenbored','candy-ai','Candy.ai','ai','crakrevenue','da_cam','40% revshare lifetime (9022) · PPS $36 (10022) / $44 T1 (10335)','https://t.vlmai-5.com/423371/7793?aff_sub5=SF_006OG000004lmDN&aff_sub={SUBID}','/go/candy-ai/',447,918,'Chạy PPS tuần đầu để đo nhanh, đổi revshare cho zone giữ chân',NULL),
('chatwhenbored','stripchat','Stripchat','cam','stripcash','cho_duyet','REV 20% (scheme), payout 1 & 16 hàng tháng','(sau duyệt: Links Builder)',NULL,449,923,'Chờ Stripcash duyệt đơn nguồn traffic (≤24h) → link + Nifty Stats API key','SSO Google eimagini.info, đơn nộp 14/09 17h'),
('chatwhenbored','bongacams','BongaCams','cam','bongacash','da_dang_ky','20–25% revshare trọn đời, PPS $4.5','(sau bước 2)',NULL,450,925,'Anh: bước 2 hồ sơ cần địa chỉ + số giấy tờ persona','Tài khoản mikerey887 tạo 14/09'),
('chatwhenbored','nomi','Nomi','ai','rewardful','chua','30% recurring trọn đời',NULL,NULL,448,919,'Anh đăng ký tay (Turnstile chặn rig) — vault #448 có mật khẩu',NULL),
('chatwhenbored','spicychat','SpicyChat','ai','tapfiliate','chua','30% standard / initial / renewal',NULL,NULL,453,NULL,'Anh: giải reCAPTCHA + bấm Sign up (form điền sẵn, mở lại br khi anh rảnh)',NULL),
('chatwhenbored','crushon-ai','CrushOn.AI','ai','tapfiliate','cho_duyet','~30% commission (Tapfiliate)',NULL,NULL,452,924,'Chờ họ trả lời đơn Google Form (email/Telegram davidwr)','Đơn gửi 14/09'),
('chatwhenbored','kindroid','Kindroid','ai','none','khong_co','chỉ referral credit',NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','replika','Replika','ai','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,'Không tìm thấy chương trình affiliate (14/09)'),
('chatwhenbored','character-ai','Character.AI','ai','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','chai','Chai','ai','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','talkie','Talkie','ai','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','janitor-ai','Janitor AI','ai','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,'janitorai.ai/affiliate là site nhái, thật là janitorai.com — bỏ'),
('chatwhenbored','chatrandom','Chatrandom','random','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,'Không còn trên CrakRevenue (14/09)'),
('chatwhenbored','shagle','Shagle','random','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,'Không còn trên CrakRevenue (14/09)'),
('chatwhenbored','chatspin','Chatspin','random','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','chatroulette','Chatroulette','random','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','emerald-chat','Emerald Chat','random','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','monkey','Monkey','random','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','ometv','OmeTV','random','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','camsurf','CamSurf','random','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','bazoocam','Bazoocam','random','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','talkwithstranger','TalkWithStranger','text','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','discord','Discord','community','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','7cups','7 Cups','community','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','wakie','Wakie','text','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','slowly','Slowly','text','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
('chatwhenbored','reddit-casualconversation','r/CasualConversation','community','none','khong_co',NULL,NULL,NULL,NULL,NULL,NULL,NULL)
ON CONFLICT (project_id, slug) DO NOTHING;

INSERT INTO phu_nguon (project_id, key, name, loai, trang_thai, macro_click, ghi_chu, postback_token) VALUES
('chatwhenbored','exoclick','ExoClick','pop','du_kien','{click_id}','Pop/tab-under + native trên tube adult; nạp tối thiểu kiểm lúc mở tài khoản (anh mở)', encode(gen_random_bytes(12),'hex')),
('chatwhenbored','trafficjunky','TrafficJunky','pop','du_kien','{click_id}','Mạng Pornhub; target theo keyword/tag video (webcam, amateur, live)', encode(gen_random_bytes(12),'hex')),
('chatwhenbored','bidvertiser','Bidvertiser','pop','du_kien','{bv_clickid}','Đã có tài khoản (dự án Cities); adult pop/native làm đối chứng giá rẻ', encode(gen_random_bytes(12),'hex')),
('chatwhenbored','trafficstars','TrafficStars','native','du_kien','{click_id}','Native trên xHamster; góc AI companion', encode(gen_random_bytes(12),'hex')),
('chatwhenbored','bing','Microsoft Ads','search','du_kien','{msclkid}','CHỈ góc SFW AI companion (Nomi) — Bing cấm cam/sex', encode(gen_random_bytes(12),'hex'))
ON CONFLICT (project_id, key) DO NOTHING;

INSERT INTO phu_adapter (project_id, key, name, loai, lich, last_note) VALUES
('chatwhenbored','log-box2','Nhật ký click + cửa ra (box2)','cron','*/15 * * * *','chưa chạy'),
('chatwhenbored','chaturbate-stats','Chaturbate apistats (doanh thu/ngày)','cron','20 5 * * *','chưa chạy'),
('chatwhenbored','postback-crakrevenue','Postback CrakRevenue','postback','khi mạng gọi','chưa cấu hình trên CrakRevenue (Postbacks Options)'),
('chatwhenbored','postback-awempire','Postback AWEmpire','postback','khi mạng gọi','chưa cấu hình (Postback Editor)'),
('chatwhenbored','postback-stripcash','Postback Stripcash','postback','khi mạng gọi','sau duyệt: Service → Postback Setup')
ON CONFLICT (project_id, key) DO NOTHING;
