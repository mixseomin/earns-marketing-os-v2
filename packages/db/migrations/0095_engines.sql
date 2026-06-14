-- 0095: relational engine SPEC catalog. Was: engine config (endpoint/label/flags) hardcoded in the
-- extension ENGINES registry; only the per-project enable-list lived in projects.capabilities.engines.
-- This table makes the SPEC dashboard-editable + queryable (no ext rebuild to tweak endpoint/model/flags).
-- GATING stays on capabilities.engines (per-project allow-list); BEHAVIOR (payload/fmt/preCheck fns) stays
-- in the ext keyed by engine key. So this is the data half; the ext fetches it and overrides its defaults.
CREATE TABLE IF NOT EXISTS engines (
  key           TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#6366f1',
  title         TEXT NOT NULL DEFAULT '',
  working       TEXT NOT NULL DEFAULT '',
  needs_depth   BOOLEAN NOT NULL DEFAULT false,
  needs_vision  BOOLEAN NOT NULL DEFAULT false,
  default_model TEXT,
  monthly_cost  INTEGER NOT NULL DEFAULT 0,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill the 2 specs currently hardcoded in the ext (content.js ENGINES).
INSERT INTO engines (key, label, endpoint, color, title, working, needs_depth, needs_vision, sort_order) VALUES
  ('astrolas', '⭐ Astrolas', '/api/ext/seeding/astrolas-answer', '#a855f7',
   'Gen bằng engine data-backed Astrolas (LLM xịn + citations)', '⭐ Astrolas…', true, true, 1),
  ('hyperjournal', '🔗 HyperJournal', '/api/ext/seeding/hyperjournal-answer', '#0e9f6e',
   'Gen reply data-backed: phát hiện ví (0x…) → grade hljournal.xyz → chèn link teardown', '🔗 grade…', false, false, 2)
ON CONFLICT (key) DO NOTHING;
