-- 0097: AdSense daily revenue reports. Pulled by /opt/cgg-report/adsense_check.mjs
-- once per day, scoped to OAuth user htuan82@gmail.com (admin on both pub accounts).
-- One row per (account_id, date, site_domain) — site_domain '' = account-wide total
-- when AdSense returns no DOMAIN_NAME breakdown.
CREATE TABLE IF NOT EXISTS adsense_daily (
  id            BIGSERIAL PRIMARY KEY,
  account_id    BIGINT NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
  pub_id        TEXT NOT NULL,                      -- 'pub-XXXX', mirrored from platform_accounts.handle
  date          DATE NOT NULL,
  site_domain   TEXT NOT NULL DEFAULT '',           -- '' = account-wide total
  earnings_usd  NUMERIC(10,4) NOT NULL DEFAULT 0,
  impressions   INTEGER NOT NULL DEFAULT 0,
  clicks        INTEGER NOT NULL DEFAULT 0,
  page_views    INTEGER NOT NULL DEFAULT 0,
  rpm_usd       NUMERIC(8,4) NOT NULL DEFAULT 0,    -- impressions RPM (earnings per 1k impressions)
  cpc_usd       NUMERIC(6,4) NOT NULL DEFAULT 0,
  raw           JSONB,                              -- raw row from AdSense API
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT adsense_daily_uniq UNIQUE (account_id, date, site_domain)
);

CREATE INDEX IF NOT EXISTS adsense_daily_date_idx ON adsense_daily (date DESC);
CREATE INDEX IF NOT EXISTS adsense_daily_project_idx ON adsense_daily (project_id, date DESC);
CREATE INDEX IF NOT EXISTS adsense_daily_site_idx ON adsense_daily (site_domain, date DESC);
