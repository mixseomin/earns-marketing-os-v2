-- Discovery inbox: ext fingerprint-detects the underlying forum engine / tech
-- (xenforo/phpbb/discourse/...) on a site and POSTs it here. Studio "Template
-- Adoption" reads this to suggest binding the platform to that technology so it
-- inherits the technology-scope selector pack (1 template → N forums).
-- Intentionally separate from `platforms` so a brand-new forum (no platform row
-- yet) is still captured as an adoption candidate; binding never happens silently.
CREATE TABLE IF NOT EXISTS platform_tech_detections (
  host           text PRIMARY KEY,            -- 'resetera.com' (canonical hostname)
  platform_key   text NOT NULL,               -- host-derived key ('resetera-com')
  technology_key text NOT NULL,               -- detected engine ('xenforo')
  hits           integer NOT NULL DEFAULT 1,
  first_seen     timestamptz NOT NULL DEFAULT now(),
  last_seen      timestamptz NOT NULL DEFAULT now(),
  url            text
);
CREATE INDEX IF NOT EXISTS platform_tech_detections_tech_idx ON platform_tech_detections (technology_key);
CREATE INDEX IF NOT EXISTS platform_tech_detections_pkey_idx ON platform_tech_detections (platform_key);
