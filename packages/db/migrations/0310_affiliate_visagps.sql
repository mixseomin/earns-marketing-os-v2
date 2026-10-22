-- city góp ý #1436 (anh 23/10/2026 "VisaGPS cho vào trại affiliate, các nguồn traffic cũng phải đi theo"): visagps.com về dự án Affiliate.
-- Toà traffic đứng quanh site nên tự đi theo site; du_an_site thắng projects.website (dự án VisaGPS không còn đích nào thì khu tự biến mất).
INSERT INTO du_an_site (site, project_id, ghi) VALUES ('visagps.com', 'affiliate', 'góp ý city #1436')
ON CONFLICT (site) DO UPDATE SET project_id = EXCLUDED.project_id, ghi = EXCLUDED.ghi;
