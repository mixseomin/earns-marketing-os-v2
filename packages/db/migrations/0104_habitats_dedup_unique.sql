-- Habitat dedup guard (2026-06-19): the Crew ext habitat-import did
-- check-then-insert (no atomicity), so a double-fire ~1-11ms apart created
-- duplicate habitats (8 pairs found: r/astrosignature, r/vscode, ...). Fix =
-- a unique index on (project_id, platform_key, lower(name)). NULL platform_key
-- rows stay distinct (Postgres NULL semantics), matching prior behavior.
-- Routes /api/ext/habitats + /habitats/ensure now use ON CONFLICT DO NOTHING
-- + re-select so a lost race resolves idempotently instead of 500-ing.
-- NOTE: existing duplicates were merged (loser briefs deleted, losers removed)
-- BEFORE this index could be created.
CREATE UNIQUE INDEX IF NOT EXISTS habitats_proj_plat_lname_uniq
  ON habitats (project_id, platform_key, lower(name));
