-- THÀNH PHỐ (anh 22/10/2026): "các dự án thuộc lĩnh vực như du lịch, dropship… làm sao để phân biệt?" → mỗi lĩnh vực là một PHƯỜNG riêng (cổng + nền màu).
-- Sổ gán lĩnh vực: khoa = 'p:<project_id>' (dự án) hoặc 's:<host>' (site đứng riêng). Chưa có dòng = lĩnh vực 'khac'. Danh sách lĩnh vực + màu: lib/social-thanh-pho.ts › LINH_VUC.
CREATE TABLE IF NOT EXISTS linh_vuc_gan (
  khoa text PRIMARY KEY,
  linh_vuc text NOT NULL,
  ghi text,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO linh_vuc_gan (khoa, linh_vuc, ghi) VALUES
  ('s:ratesbyroom.com', 'du-lich', 'gán ban đầu 22/10/2026'), ('s:esimfares.com', 'du-lich', null), ('s:ratesbycar.com', 'du-lich', null), ('s:transferfares.com', 'du-lich', null),
  ('s:venuefares.com', 'du-lich', null), ('s:staymarlow.com', 'du-lich', null), ('p:visagps', 'du-lich', null), ('s:visagps.com', 'du-lich', null),
  ('p:bra', 'thuong-mai', null), ('p:mellowstep', 'thuong-mai', null),
  ('p:clane', 'app', null), ('p:ios-app', 'app', null), ('p:wordfrost', 'app', null), ('p:ad-revenue', 'app', null), ('s:giochap.com', 'app', null), ('s:clane.app', 'app', null), ('s:wordfrost.com', 'app', null),
  ('p:steamsolo', 'game', null), ('p:cities-gg', 'game', null), ('s:steamsolo.com', 'game', null), ('s:cities.gg', 'game', null),
  ('p:militarycalc', 'tai-chinh', null), ('p:militarymarkdown', 'tai-chinh', null), ('p:govcalcs', 'tai-chinh', null), ('p:paydochub', 'tai-chinh', null), ('p:mint-almanac', 'tai-chinh', null),
  ('s:militarycalc.com', 'tai-chinh', null), ('s:militarymarkdown.com', 'tai-chinh', null), ('s:govcalcs.com', 'tai-chinh', null), ('s:paydochub.com', 'tai-chinh', null), ('s:mintalmanac.com', 'tai-chinh', null), ('s:dehumidifiercalc.com', 'tai-chinh', null),
  ('p:examweight', 'giao-duc', null), ('p:courseforge', 'giao-duc', null), ('s:examweight.com', 'giao-duc', null), ('s:jobzab.com', 'giao-duc', null),
  ('p:puzzle-books', 'xuat-ban', null), ('p:codecrate', 'xuat-ban', null), ('s:pickjot.com', 'xuat-ban', null), ('s:frontporchpuzzles.gumroad.com', 'xuat-ban', null),
  ('p:hedge-manager-pro', 'trading', null), ('p:market-regime-radar', 'trading', null), ('p:hyperjournal', 'trading', null), ('p:strategy-lab', 'trading', null), ('p:crypto-arbitrage-scanner', 'trading', null),
  ('p:astrolas', 'ai', null), ('p:orit', 'ai', null), ('p:maileyes', 'ai', null), ('p:chatwhenbored', 'ai', null), ('p:transcribe', 'ai', null), ('p:ravion', 'ai', null), ('p:wenoted', 'ai', null),
  ('s:astrolas.com', 'ai', null), ('s:maileyes.com', 'ai', null), ('s:chatwhenbored.com', 'ai', null), ('s:chatlt.com', 'ai', null), ('s:wenoted.com', 'ai', null),
  ('p:adfond', 'quang-cao', null), ('p:ethopex', 'quang-cao', null), ('p:aff-vn', 'quang-cao', null), ('p:yt-aff', 'quang-cao', null), ('p:earns-io', 'quang-cao', null),
  ('s:trafficbuyersguide.com', 'quang-cao', null), ('s:earns.io', 'quang-cao', null)
ON CONFLICT (khoa) DO NOTHING;
-- anh 22/10/2026: "dự án app là app chứ không phải mỗi iOS" — app Giỗ Chạp (iOS + Windows) thuộc dự án gốc app Clane
UPDATE app_ung_dung SET project_id = 'clane' WHERE project_id = 'ios-app' AND EXISTS (SELECT 1 FROM projects WHERE id = 'clane');
