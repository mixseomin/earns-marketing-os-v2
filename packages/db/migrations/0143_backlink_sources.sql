-- Backlink source CATALOG — canonical, reusable-across-projects list of backlink sources.
-- Before this, every source was re-embedded per project inside human_tasks.prep_payload
-- (176 tasks / only 113 distinct sources = duplication), and instructions were re-generated
-- ad-hoc per project → drift + hallucination. This table is the single source of truth: one
-- row per source, with a TEMPLATED instruction ({product}/{domain}/{topic} placeholders) that
-- seeding fills per project. See decision 2026-07-19-backlink-source-catalog-standardization.
-- Idempotent (IF NOT EXISTS) — the file-based migration runner (deploy.sh step 4a) re-runs it.
CREATE TABLE IF NOT EXISTS backlink_sources (
  id                   serial PRIMARY KEY,
  canonical_url        text NOT NULL,                     -- exact ACTION page (submit form / new-post / question), NOT a homepage
  name                 text NOT NULL,                     -- display name (e.g. "AlternativeTo", "itch.io")
  category             text,                              -- tool-dir | forum | edu-resource | haro | listicle | wiki | social | llms | qa | directory | guest-post
  mechanism            text,                              -- 1-line: what link + how
  dofollow             text,                              -- dofollow | nofollow | mixed  (HONEST)
  da                   text,                              -- authority bucket or number
  traffic              text,
  audience_tags        text[] NOT NULL DEFAULT '{}',      -- {military,finance,veterans,gov,retirement,immigration,email,games,dev,general,…}
  instruction_template text,                              -- canonical instructions with {product}/{domain}/{topic} placeholders
  gates                text,                              -- real gates (karma/rep/notability/email-match/…)
  eligibility          text[] NOT NULL DEFAULT '{}',      -- optional: which project kinds fit (mirrors/refines audience_tags)
  platform_key         text,                              -- for account resolution (matches platforms.key when applicable)
  verified_at          timestamptz,                       -- last time canonical_url + dofollow were web-verified
  source_status        text NOT NULL DEFAULT 'active',    -- active | broken | needs-review | archived
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- One catalog row per action URL.
CREATE UNIQUE INDEX IF NOT EXISTS backlink_sources_canonical_url_key ON backlink_sources (canonical_url);
-- Filter by audience (the seed picker's main query) + by status (cron freshness).
CREATE INDEX IF NOT EXISTS backlink_sources_audience_idx ON backlink_sources USING gin (audience_tags);
CREATE INDEX IF NOT EXISTS backlink_sources_status_idx ON backlink_sources (source_status);
