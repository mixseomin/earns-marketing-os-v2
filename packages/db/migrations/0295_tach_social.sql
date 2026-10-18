-- TÁCH SOCIAL KHỎI ADFOND (anh 18/10/2026: "bỏ adfond ra khỏi dự án social này") — cùng khuôn tách bra 20/09.
-- Dự án mos2 riêng 'social' (Social Traffic): bộ kênh mạng xã hội kéo traffic về site (Hotel Scam Alerts → ratesbyroom.com, Before You Land → esimfares.com),
-- máy đăng studio của chúng, sổ tiến độ S01–S03 và tài khoản vault của các kênh. Site đích (hotel-arb) vẫn thuộc adfond; Front Porch vẫn thuộc puzzle-books.
INSERT INTO projects (id, name, emoji, mode_id, one_liner, stack)
VALUES ('social', 'Social Traffic', '📣', 'marketing',
  'Bộ kênh mạng xã hội kéo traffic về site: Hotel Scam Alerts (ratesbyroom.com), Before You Land (esimfares.com)',
  'studio.on.tc máy đăng (xv_may) · puzzle-books dang-may / nhịp an toàn · cty Phòng Nội dung chấm bài đăng')
ON CONFLICT (id) DO NOTHING;

-- sổ tiến độ: S01 bộ kênh Hotel, S02 roadmap đợt 2, S03 hệ đăng đa dạng
UPDATE tien_do_hang_muc SET project_id = 'social' WHERE project_id = 'adfond' AND nhom = 'Social traffic' AND ma IN ('S01', 'S02', 'S03');

-- tài khoản của các kênh (Outlook danh tính Hotel, Pinterest, X ×2, Quora, YouTube ×2, FB Page ×2, IG, Outlook BYL, Dailymotion ×2)
UPDATE platform_accounts SET project_id = 'social', updated_at = now()
WHERE project_id = 'adfond' AND id IN (490, 539, 540, 541, 543, 544, 545, 546, 547, 548, 549, 550, 551);
UPDATE project_accounts SET project_id = 'social'
WHERE project_id = 'adfond' AND account_id IN (490, 539, 540, 541, 543, 544, 545, 546, 547, 548, 549, 550, 551)
  AND NOT EXISTS (SELECT 1 FROM project_accounts p2 WHERE p2.project_id = 'social' AND p2.account_id = project_accounts.account_id);

-- thẻ việc "Mở bộ kênh ngách đặt phòng khách sạn"
UPDATE human_tasks SET project_id = 'social' WHERE project_id = 'adfond' AND account_id IN (490, 539, 540, 541, 543, 544, 545, 546, 547, 548, 549, 550, 551);

-- máy đăng studio
UPDATE xv_may SET du_an = 'social', updated_at = now() WHERE du_an = 'adfond' AND ma IN ('ratesbyroom-scam-or-real', 'esimfares-before-you-land');
