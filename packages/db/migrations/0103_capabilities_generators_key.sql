-- 0103: ADDITIVE capabilities key — mirror projects.capabilities->'engines' into a new
-- 'generators' key (the content-GENERATOR per-project allow-list).
--
-- Context: gating for content generators (Astrolas QA / HyperJournal) lives in
-- projects.capabilities (shape: { "engines": ["astrolas"] }, set by 0090). The concept is renamed to
-- "generator", so new readers prefer capabilities.generators. We ADD the new key WITHOUT dropping the
-- old one: old ext builds still read capabilities.engines, and new server code reads
-- `capabilities.generators ?? capabilities.engines`. Both stay valid during the transition.
--
-- Idempotent: only copies for rows that have the legacy `engines` key and do NOT yet have `generators`.
-- Re-running is a no-op once mirrored. (We intentionally do not keep the two keys in sync afterwards —
-- once the ext writes `generators` directly this backfill is obsolete.)

UPDATE projects
SET capabilities = capabilities || jsonb_build_object('generators', capabilities -> 'engines')
WHERE capabilities ? 'engines'
  AND NOT (capabilities ? 'generators');
