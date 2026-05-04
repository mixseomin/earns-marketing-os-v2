-- 0037_multi_brand_accounts.sql
-- Lý do: 1 platform_account (vd: @tuan_builds trên X) cần dùng được cho nhiều brands
-- (Astrolas, Orit...) thay vì gắn cứng 1 project. Tách account thành tenant resource,
-- thêm pivot project_accounts với content_ratio để phân bổ % nội dung mỗi brand.

-- 1. Account không bắt buộc gắn project (trở thành tenant resource)
ALTER TABLE platform_accounts ALTER COLUMN project_id DROP NOT NULL;

-- 2. Thay unique (project_id, platform_key, handle) → (tenant_id, platform_key, handle)
DROP INDEX IF EXISTS accounts_proj_platform_handle_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_tenant_platform_handle_uniq
  ON platform_accounts(tenant_id, platform_key, handle)
  WHERE handle IS NOT NULL;

-- 3. Pivot project ↔ account
CREATE TABLE IF NOT EXISTS project_accounts (
  project_id   text   NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id   bigint NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  role         text   NOT NULL DEFAULT 'shared',     -- 'primary' | 'shared'
  content_ratio integer NOT NULL DEFAULT 0,          -- 0-100, % nội dung từ account này dành cho project này
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, account_id)
);
CREATE INDEX IF NOT EXISTS project_accounts_account_idx ON project_accounts(account_id);

-- 4. Backfill: mỗi account hiện tại → 1 row pivot 'primary' 100%
INSERT INTO project_accounts (project_id, account_id, role, content_ratio)
SELECT project_id, id, 'primary', 100
FROM platform_accounts
WHERE project_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN platform_accounts.project_id IS
  'Owner project (creator). Để có full project↔account mapping (multi-brand) JOIN qua project_accounts.';
COMMENT ON COLUMN project_accounts.content_ratio IS
  '% nội dung từ account này dành cho project này. Tổng các project share account nên ~100.';
