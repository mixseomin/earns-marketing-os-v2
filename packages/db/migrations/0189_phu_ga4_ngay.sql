-- GA4 theo ngày cho sổ PHỦ (01/10/2026, anh chốt: mellowstep + mảng adult có report riêng trên mos2, KHÔNG be.adfond).
-- Adapter scripts/phu/ga4-ngay.mjs (box3, mỗi giờ) kéo Data API của các property trong tài khoản GA "Adult" (71408749)
-- và đổ qua /api/phu/ingest {ga4:[…]}. Khoá = (project, ngày, nguồn, camp) — `camp` = utm_campaign, cùng khuôn sid_prefix
-- của phu_chi/phu_su_kien để /report2 ghép phiên với chi và đơn trên cùng một dòng.
CREATE TABLE IF NOT EXISTS phu_ga4_ngay (
  project_id   text    NOT NULL,
  ngay         date    NOT NULL,
  nguon        text    NOT NULL DEFAULT '',   -- sessionSource ('(direct)', 'facebook', 'google'…)
  camp         text    NOT NULL DEFAULT '',   -- sessionCampaignName ('(not set)' → '')
  phien        integer NOT NULL DEFAULT 0,    -- sessions
  phien_tt     integer NOT NULL DEFAULT 0,    -- engagedSessions
  them_gio     integer NOT NULL DEFAULT 0,    -- addToCarts
  thanh_toan   integer NOT NULL DEFAULT 0,    -- checkouts
  mua          integer NOT NULL DEFAULT 0,    -- ecommercePurchases
  doanh_thu    numeric NOT NULL DEFAULT 0,    -- purchaseRevenue (USD) — chỉ để đối chiếu; doanh thu chuẩn là đơn trong phu_su_kien
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, ngay, nguon, camp)
);
