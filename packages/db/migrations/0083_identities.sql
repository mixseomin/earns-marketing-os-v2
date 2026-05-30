-- Req#3: identities = preset persona/brand per project, tái dùng để pre-fill
-- form tạo account trên platform/forum bất kỳ. password_enc = pgcrypto
-- (encryptValue/lib/crypto). persona khớp shape platform_accounts.persona;
-- custom_fields = value cho field signup lạ per-platform.
CREATE TABLE IF NOT EXISTS identities (
  id            bigserial PRIMARY KEY,
  tenant_id     text NOT NULL DEFAULT 'self',
  project_id    text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          text NOT NULL,
  kind          text NOT NULL DEFAULT 'seeding',     -- brand | seeding
  handle_base   text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  password_enc  text,                                -- encryptValue() base64 ciphertext, nullable
  display_name  text NOT NULL DEFAULT '',
  bio           text NOT NULL DEFAULT '',
  avatar_url    text NOT NULL DEFAULT '',
  persona       jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identities_project_idx ON identities(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON identities TO mos2;
GRANT USAGE, SELECT ON SEQUENCE identities_id_seq TO mos2;
