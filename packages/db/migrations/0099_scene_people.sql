-- WHO-THEM layer: track interaction-network participants (reply-guy scene /
-- forum repliers) as queryable people + interactions. Until now their handles
-- were buried per-card in cards.insights_top_replies (JSONB). This makes them a
-- first-class, cross-thread, aggregatable axis (familiarity → bridge-ready).
-- Phase 0 = forward-fill from /api/ext/seeding/insights. Spec: earns-strategy
-- wiki/mos/crew-scene-layer.md. Idempotent.

CREATE TABLE IF NOT EXISTS people (
  id                 bigserial PRIMARY KEY,
  tenant_id          text NOT NULL DEFAULT 'self',
  project_id         text REFERENCES projects(id) ON DELETE CASCADE,
  platform_key       text NOT NULL DEFAULT '',
  handle             text NOT NULL,
  display_name       text,
  scene_tag          text,                       -- group lỏng theo topic/scene (chưa cần bảng riêng)
  habitat_id         bigint REFERENCES habitats(id) ON DELETE SET NULL,
  familiarity_score  integer NOT NULL DEFAULT 0, -- 0..100
  interaction_count  integer NOT NULL DEFAULT 0,
  they_replied_back  boolean NOT NULL DEFAULT false,
  last_engaged_at    timestamptz,
  status             text NOT NULL DEFAULT 'observed', -- observed|engaging|warm|bridged|ignore
  notes              text,
  scraped_meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS people_proj_plat_handle_uidx ON people(project_id, platform_key, handle);
CREATE INDEX IF NOT EXISTS people_project_idx ON people(project_id);
CREATE INDEX IF NOT EXISTS people_habitat_idx ON people(habitat_id);
CREATE INDEX IF NOT EXISTS people_scene_idx  ON people(scene_tag);

CREATE TABLE IF NOT EXISTS interactions (
  id            bigserial PRIMARY KEY,
  tenant_id     text NOT NULL DEFAULT 'self',
  people_id     bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  card_id       bigint REFERENCES cards(id) ON DELETE SET NULL,
  account_id    bigint,
  thread_url    text,
  kind          text NOT NULL DEFAULT 'reply',   -- reply|quote|mention|like
  direction     text NOT NULL DEFAULT 'theirs',  -- theirs|ours
  body_excerpt  text,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS interactions_dedup_uidx ON interactions(people_id, card_id, direction, kind);
CREATE INDEX IF NOT EXISTS interactions_people_idx ON interactions(people_id);
CREATE INDEX IF NOT EXISTS interactions_thread_idx ON interactions(thread_url);
CREATE INDEX IF NOT EXISTS interactions_card_idx   ON interactions(card_id);
