-- 0101: rename the selector scope value 'engine' → 'technology'.
--
-- Context: the cascade habitat > platform > engine(=technology) > generic stored its
-- 3rd tier as scope_kind='engine' in selector_overrides. The concept is renamed to
-- "technology" everywhere in the web app (route /technologies, platform_technologies
-- table, technology_key field). This migration brings the stored enum value in line.
--
-- The 0061 CHECK constraint (scope_kind IN ('engine','platform','habitat')) would
-- reject an UPDATE to 'technology', so we widen it FIRST (allow both old + new during
-- transition), migrate the rows, then leave the constraint accepting the new value
-- plus 'engine' for safety against any un-migrated writer. App code normalizes legacy
-- 'engine' on read (normScopeKind / scopeKindMatch), so leaving 'engine' allowed is harmless.
--
-- Idempotent: re-running is a no-op (no 'engine' rows remain after the first pass; the
-- constraint redefinition is DROP IF EXISTS + ADD).

-- 1) Widen the CHECK constraint to allow the new value (and keep the legacy one).
ALTER TABLE selector_overrides
  DROP CONSTRAINT IF EXISTS selector_overrides_scope_chk;
ALTER TABLE selector_overrides
  ADD CONSTRAINT selector_overrides_scope_chk
  CHECK (scope_kind IN ('engine', 'technology', 'platform', 'habitat'));

-- 2) Migrate existing rows.
UPDATE selector_overrides SET scope_kind = 'technology' WHERE scope_kind = 'engine';
