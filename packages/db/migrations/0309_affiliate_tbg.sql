-- city góp ý #1432 (anh 23/10/2026 "cho vào dự án affiliate"): trafficbuyersguide.com về dự án Affiliate (0307).
INSERT INTO du_an_site (site, project_id, ghi) VALUES ('trafficbuyersguide.com', 'affiliate', 'góp ý city #1432')
ON CONFLICT (site) DO UPDATE SET project_id = EXCLUDED.project_id, ghi = EXCLUDED.ghi;
