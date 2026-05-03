-- Per-user visibility overrides
ALTER TABLE members ADD COLUMN IF NOT EXISTS visibility_config JSONB DEFAULT NULL;
ALTER TABLE members ADD COLUMN IF NOT EXISTS config_version INT NOT NULL DEFAULT 0;

-- Per-role defaults (operator / viewer)
CREATE TABLE IF NOT EXISTS role_visibility_configs (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'self',
  role TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, role)
);
