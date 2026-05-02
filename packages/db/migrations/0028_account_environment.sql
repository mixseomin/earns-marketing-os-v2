-- Account environment + proxy pool + browser profiles
-- Goal: cho phép từng platform_account gắn với (browser profile, proxy, fingerprint)
-- để inbox UI hint user dùng đúng environment khi đăng bài.

-- Bảng proxy pool — share cross-account
CREATE TABLE IF NOT EXISTS proxies (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'self',
  label TEXT NOT NULL,                          -- "SG-mobile-3", "US-residential-vps-1"
  type TEXT NOT NULL DEFAULT 'datacenter',      -- mobile|residential|datacenter|isp
  endpoint TEXT NOT NULL,                       -- "user:pass@host:port" or "socks5://..."
  location TEXT,                                -- ISO country/region (vd "SG-Singapore")
  health TEXT NOT NULL DEFAULT 'unknown',       -- ok|degraded|down|unknown
  last_check_at TIMESTAMPTZ,
  cost_per_gb_cents INTEGER NOT NULL DEFAULT 0, -- approximate cost track
  rotates_at TIMESTAMPTZ,                       -- nếu mobile/sticky session: khi nào IP đổi
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS proxies_tenant_idx ON proxies(tenant_id);
CREATE INDEX IF NOT EXISTS proxies_type_idx ON proxies(type);

-- Bảng browser profile — anti-detect tools (GenLogin, Multilogin, AdsPower, Chrome native)
CREATE TABLE IF NOT EXISTS browser_profiles (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'self',
  label TEXT NOT NULL,                          -- "GL-orit-medium-01"
  tool TEXT NOT NULL,                           -- genlogin|multilogin|adspower|kameleo|chrome|firefox
  external_id TEXT,                             -- profile UUID/ID trong tool
  user_agent TEXT,
  fingerprint JSONB NOT NULL DEFAULT '{}'::jsonb, -- {screen, timezone, lang, webgl, canvas...}
  default_proxy_id BIGINT REFERENCES proxies(id) ON DELETE SET NULL,
  last_opened_at TIMESTAMPTZ,
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS browser_profiles_tenant_idx ON browser_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS browser_profiles_tool_idx ON browser_profiles(tool);

-- Account environment fields. Quick-win JSONB + 2 FK cho normalize step sau.
ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS environment JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS proxy_id BIGINT REFERENCES proxies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS browser_profile_id BIGINT REFERENCES browser_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS accounts_proxy_idx ON platform_accounts(proxy_id);
CREATE INDEX IF NOT EXISTS accounts_browser_idx ON platform_accounts(browser_profile_id);
