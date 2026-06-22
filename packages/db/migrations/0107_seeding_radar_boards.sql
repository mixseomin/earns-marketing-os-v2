-- Seeding Radar Phase 1 (2026-06-22): shared board catalog + per-project topic-fit cache.
-- See decision earns-strategy/decisions/2026-06-22-seeding-radar-place-detector.md.
-- Additive + idempotent (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS). board_id stays
-- NULLABLE permanently. Backfill is idempotent (NOT EXISTS guard, not unique-index dependent).

-- ── Layer 1: platform_boards — SHARED catalog, platform-truth only ──────────
-- 2 grain via parent_board_id: community (subreddit/server/forum = join unit) and post-target
-- (subforum/channel = post unit). Identity = engine-aware external_id (reuse /resolve), NOT name.
CREATE TABLE IF NOT EXISTS platform_boards (
  id              bigserial PRIMARY KEY,
  tenant_id       text NOT NULL DEFAULT 'self',
  platform_key    text REFERENCES platforms(key) ON DELETE SET NULL,
  technology_key  text REFERENCES platform_technologies(key) ON DELETE SET NULL,
  external_id     text,
  url             text,
  name            text NOT NULL,
  full_path       text,
  parent_board_id bigint REFERENCES platform_boards(id) ON DELETE SET NULL,
  description     text NOT NULL DEFAULT '',
  members         integer NOT NULL DEFAULT 0,
  privacy         text NOT NULL DEFAULT '',
  raw_meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_boards_tenant_idx   ON platform_boards (tenant_id);
CREATE INDEX IF NOT EXISTS platform_boards_platform_idx ON platform_boards (platform_key);
CREATE INDEX IF NOT EXISTS platform_boards_parent_idx   ON platform_boards (parent_board_id);
-- Primary natural key: (tenant, platform, external_id). NULL external_id rows stay distinct
-- (Postgres NULL semantics) → custom forums fall through to the url fallback below.
CREATE UNIQUE INDEX IF NOT EXISTS platform_boards_ext_uq
  ON platform_boards (tenant_id, platform_key, external_id);
-- Fallback identity for custom forums (no external_id AND no platform_key): dedup by lower(url).
-- url <> '' required: legacy habitats store '' (not NULL) for missing url → empty-url boards
-- can't be deduped by url and must fall through to the name-keyed backfill guard instead.
CREATE UNIQUE INDEX IF NOT EXISTS platform_boards_url_uq
  ON platform_boards (tenant_id, lower(url))
  WHERE external_id IS NULL AND platform_key IS NULL AND url IS NOT NULL AND url <> '';

-- ── Layer 2: board_project_score — topic-fit cache, ACCOUNT-INDEPENDENT ─────
-- No column references platform_accounts (hard invariant). Dual hash + schema_version invalidate.
CREATE TABLE IF NOT EXISTS board_project_score (
  id                  bigserial PRIMARY KEY,
  tenant_id           text NOT NULL DEFAULT 'self',
  board_id            bigint NOT NULL REFERENCES platform_boards(id) ON DELETE CASCADE,
  project_id          text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fit                 integer NOT NULL,
  topic_tier          text NOT NULL,
  reason              text NOT NULL DEFAULT '',
  project_inputs_hash text NOT NULL,
  board_inputs_hash   text NOT NULL,
  schema_version      integer NOT NULL DEFAULT 1,
  model               text NOT NULL DEFAULT '',
  stale               boolean NOT NULL DEFAULT false,
  scored_at           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS board_project_score_uq          ON board_project_score (tenant_id, board_id, project_id);
CREATE INDEX        IF NOT EXISTS board_project_score_project_idx ON board_project_score (project_id);
CREATE INDEX        IF NOT EXISTS board_project_score_stale_idx   ON board_project_score (stale);

-- ── Layer 3 adoption links (nullable forever) ──────────────────────────────
-- habitats.board_id = community-grain; habitat_channels.board_id = post-target-grain.
-- ON DELETE SET NULL: deleting a catalog board must NOT wipe project habitats/channels/briefs/cards.
ALTER TABLE habitats         ADD COLUMN IF NOT EXISTS board_id bigint REFERENCES platform_boards(id) ON DELETE SET NULL;
ALTER TABLE habitat_channels ADD COLUMN IF NOT EXISTS board_id bigint REFERENCES platform_boards(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS habitats_board_idx         ON habitats (board_id);
CREATE INDEX IF NOT EXISTS habitat_channels_board_idx ON habitat_channels (board_id);

-- ── Backfill: one catalog board per existing habitat, link community-grain board_id ────
-- Keyed by (tenant, platform_key, lower(name)) per the dedup contract (mig 0104). external_id
-- left NULL (true engine discriminator resolved in Phase 2); idempotency comes from the NOT EXISTS
-- guard (NOT the unique index, which treats NULL external_id as distinct). Re-runnable safely.
INSERT INTO platform_boards (tenant_id, platform_key, technology_key, url, name, description, members, privacy, raw_meta)
SELECT DISTINCT ON (h.tenant_id, h.platform_key, lower(h.name))
       h.tenant_id, h.platform_key, h.technology_key, h.url, h.name, h.description, h.members, h.privacy,
       jsonb_build_object('backfilled_from_habitat', true)
FROM habitats h
WHERE h.board_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform_boards b
    WHERE b.tenant_id = h.tenant_id
      AND b.platform_key IS NOT DISTINCT FROM h.platform_key
      AND lower(b.name) = lower(h.name)
  )
ORDER BY h.tenant_id, h.platform_key, lower(h.name), h.id;

UPDATE habitats h
SET board_id = b.id
FROM platform_boards b
WHERE h.board_id IS NULL
  AND b.tenant_id = h.tenant_id
  AND b.platform_key IS NOT DISTINCT FROM h.platform_key
  AND lower(b.name) = lower(h.name);
