-- Scheduler tables: cron_jobs + cron_runs
-- Soft-throttle pattern: systemd fires frequently, endpoint checks next_run_at.

CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  interval_minutes INTEGER NOT NULL DEFAULT 5,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status TEXT DEFAULT 'never',
  next_run_at TIMESTAMPTZ,
  last_report JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cron_runs (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES cron_jobs(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running',
  report JSONB DEFAULT '{}'::jsonb NOT NULL,
  error_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_started ON cron_runs(job_id, started_at DESC);

INSERT INTO cron_jobs (id, label, description, interval_minutes, enabled, next_run_at) VALUES
  ('worker',       'Agent Worker',         'Run agent runtime — process queued dispatch_ready cards',      5,  true, NOW()),
  ('publications', 'Publication Monitor',  'Check forum/Reddit/HN posts for new replies → spawn tasks',   30, true, NOW()),
  ('warmup',       'Account Warmup',       'Check warmup status of platform accounts (early warning)',     60, true, NOW())
ON CONFLICT DO NOTHING;
