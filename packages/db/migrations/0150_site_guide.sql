-- site_guide: per-host "cách làm task trên site này" — assemble tại page từ platform/habitat/DOM đã học,
-- CHỦ ĐỘNG lưu thành thư viện cho lần sau (yêu cầu ext #3). sections jsonb = {signup,posting,pages,notes,grounded}.
-- v1 = 1 guide/host (bỏ đa-technology-per-host; nâng khi 1 host chạy 2 engine khác path). Auto-grow queue (regen)
-- CHƯA làm (cần worker out-of-band). worked/broke = tally feedback từ ext.
CREATE TABLE IF NOT EXISTS site_guide (
  id             bigserial PRIMARY KEY,
  tenant_id      text NOT NULL DEFAULT 'self',
  host           text NOT NULL,
  platform_key   text,
  technology_key text,
  habitat_id     bigint,
  project_id     text,
  sections       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'draft',   -- draft | live
  version        int  NOT NULL DEFAULT 1,
  worked         int  NOT NULL DEFAULT 0,
  broke          int  NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- 1 guide / (tenant, host) — save = upsert on this key.
CREATE UNIQUE INDEX IF NOT EXISTS site_guide_host_uniq ON site_guide(tenant_id, host);
CREATE INDEX IF NOT EXISTS site_guide_host_idx ON site_guide(host);
