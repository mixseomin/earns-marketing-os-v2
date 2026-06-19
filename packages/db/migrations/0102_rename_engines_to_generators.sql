-- 0102: rename the content-GENERATION engine catalog `engines` (0095) → `generators`.
--
-- Context: there are two unrelated "engine" concepts. The selector cascade SCOPE tier was already
-- renamed engine→technology (0101). THIS one is the content/QA GENERATOR spec catalog (Astrolas QA,
-- HyperJournal wallet-grade). The web app now calls it `generators` everywhere (drizzle table,
-- /api/ext/generators, architecture spec node). This migration brings the DB in line.
--
-- A legacy `engines` VIEW aliases `generators` so any lagging reader (old ext build, ad-hoc query)
-- keeps working during the transition. The view is read-mostly; the catalog is edited via the
-- dashboard against `generators`.
--
-- Idempotent: guarded rename (only if the old table still exists and the new one does not), and the
-- alias is CREATE OR REPLACE VIEW. Re-running after the first pass is a no-op.

-- 1) Rename the table (only if not already renamed).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'engines' AND table_type = 'BASE TABLE')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name = 'generators') THEN
    ALTER TABLE engines RENAME TO generators;
  END IF;
END $$;

-- 2) Legacy alias so un-migrated readers still resolve `engines`.
--    (The rename above frees the `engines` name; recreate it as a view over generators.)
CREATE OR REPLACE VIEW engines AS SELECT * FROM generators;
