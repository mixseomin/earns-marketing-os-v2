-- 0054: seeding_schedules — recurring brand-awareness / seeding cadence
-- per community brief (account × habitat). One schedule per brief (v1).
-- next_due_at is computed-on-read (COALESCE(last_seeded_at, created_at)
-- + frequency_days); no cron in v1. Idempotent.

CREATE TABLE IF NOT EXISTS seeding_schedules (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 'self',
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  brief_id        BIGINT NOT NULL REFERENCES community_briefs(id) ON DELETE CASCADE,
  frequency_days  INTEGER NOT NULL DEFAULT 3,           -- seed every N days
  active_phases   JSONB   NOT NULL DEFAULT '[]'::jsonb, -- phases it runs in; [] = any non-paused
  paused          BOOLEAN NOT NULL DEFAULT false,
  auto_draft      BOOLEAN NOT NULL DEFAULT true,        -- semi-auto: create draft when due
  last_seeded_at  TIMESTAMPTZ,
  touch_log       JSONB   NOT NULL DEFAULT '[]'::jsonb, -- [{at, cardId, phase}]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS seeding_schedules_brief_uniq  ON seeding_schedules (brief_id);
CREATE INDEX        IF NOT EXISTS seeding_schedules_project_idx ON seeding_schedules (project_id);
CREATE INDEX        IF NOT EXISTS seeding_schedules_tenant_idx  ON seeding_schedules (tenant_id);
