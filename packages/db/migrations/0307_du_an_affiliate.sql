-- THÀNH PHỐ (anh 23/10/2026): "ratesbycar, esimfares, transferfares, venuefares, staymarlow… các site này thuộc dự án Affiliate là hợp lý nhất".
-- Dự án Affiliate gom các site so giá / vé ăn hoa hồng (trước đứng rải rác thành site riêng); AdFond vẫn là dự án riêng, cắm cờ rìa (0306).
INSERT INTO projects (id, name, emoji, mode_id, website, one_liner)
SELECT 'affiliate', 'Affiliate', '🔗', 'affiliate', '', 'Site so giá / vé ăn hoa hồng (khách sạn, xe, eSIM, đưa đón, địa điểm)'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE id = 'affiliate');
INSERT INTO du_an_site (site, project_id, ghi) VALUES
  ('ratesbycar.com', 'affiliate', 'anh 23/10/2026'), ('esimfares.com', 'affiliate', 'anh 23/10/2026'), ('transferfares.com', 'affiliate', 'anh 23/10/2026'),
  ('venuefares.com', 'affiliate', 'anh 23/10/2026'), ('staymarlow.com', 'affiliate', 'anh 23/10/2026')
ON CONFLICT (site) DO UPDATE SET project_id = EXCLUDED.project_id, ghi = EXCLUDED.ghi;
INSERT INTO linh_vuc_gan (khoa, linh_vuc, ghi) VALUES ('p:affiliate', 'du-lich', 'anh 23/10/2026') ON CONFLICT (khoa) DO UPDATE SET linh_vuc = EXCLUDED.linh_vuc;
