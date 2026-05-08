-- Platform technology engines catalog
-- Each engine has default signup_fields inherited by all platforms using it.
-- platforms and habitats can link to a technology for automatic field inference.

CREATE TABLE IF NOT EXISTS platform_technologies (
  key          TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  signup_fields JSONB NOT NULL DEFAULT '[]',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_technologies_key_idx ON platform_technologies (key);

-- platforms: link to engine + per-platform overrides
ALTER TABLE platforms
  ADD COLUMN IF NOT EXISTS technology_key TEXT REFERENCES platform_technologies(key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signup_fields  JSONB NOT NULL DEFAULT '[]';

-- habitats: communities can run on a known engine independently of their platform
ALTER TABLE habitats
  ADD COLUMN IF NOT EXISTS technology_key TEXT REFERENCES platform_technologies(key) ON DELETE SET NULL;
