-- project_browser_profiles junction (2026-08-03). Idempotent (safe to re-run each deploy).
--
-- Feature: a browser_profile can be assigned to MULTIPLE projects (many-to-many),
-- mirroring project_accounts. The table already exists on prod (created out-of-band);
-- this file is the checked-in record of that DDL. All statements use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS project_browser_profiles (
  project_id         text        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  browser_profile_id bigint      NOT NULL REFERENCES browser_profiles(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, browser_profile_id)
);

CREATE INDEX IF NOT EXISTS project_browser_profiles_profile_idx
  ON project_browser_profiles (browser_profile_id);
