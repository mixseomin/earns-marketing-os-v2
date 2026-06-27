-- Crew ext self-reported capability matrix (platform/tech × tầng support).
-- Ext buildCapabilities() reads its LIVE cfg tables → POSTs here (1 row/version, upsert).
-- Architecture Studio reads the latest row. Single source of truth = ext's real cfg, no regex/drift.
CREATE TABLE IF NOT EXISTS crew_capabilities (
  id         bigserial PRIMARY KEY,
  version    text,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crew_capabilities_version_idx ON crew_capabilities (version);
