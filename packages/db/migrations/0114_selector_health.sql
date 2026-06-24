-- Selector health telemetry: ext reports per-field resolution result on live pages.
-- miss_streak = consecutive misses (reset to 0 on any ok). >=3 ⇒ likely broken (DOM changed).
ALTER TABLE selector_overrides ADD COLUMN IF NOT EXISTS last_ok_at   timestamptz;
ALTER TABLE selector_overrides ADD COLUMN IF NOT EXISTS last_miss_at timestamptz;
ALTER TABLE selector_overrides ADD COLUMN IF NOT EXISTS miss_streak  integer NOT NULL DEFAULT 0;
ALTER TABLE selector_overrides ADD COLUMN IF NOT EXISTS last_url     text;
