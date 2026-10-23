-- city góp ý #1442 (anh 23/10/2026 "cho dehumidifiercalc vào aff"): dehumidifiercalc.com đang đứng khu riêng → về dự án Affiliate.
-- Toà traffic đứng quanh site tự đi theo; du_an_site thắng projects.website.
INSERT INTO du_an_site (site, project_id, ghi) VALUES ('dehumidifiercalc.com', 'affiliate', 'góp ý city #1442')
ON CONFLICT (site) DO UPDATE SET project_id = EXCLUDED.project_id, ghi = EXCLUDED.ghi;
