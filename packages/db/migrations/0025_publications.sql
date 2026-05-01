CREATE TABLE IF NOT EXISTS publications (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'self',
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  platform_key TEXT NOT NULL,
  account_id INTEGER,
  published_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  check_interval_hours INTEGER NOT NULL DEFAULT 6,
  next_check_at TIMESTAMPTZ,
  reply_count INTEGER DEFAULT 0,
  view_count INTEGER,
  score INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publication_activities (
  id SERIAL PRIMARY KEY,
  publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  activity_type TEXT NOT NULL DEFAULT 'reply',
  external_id TEXT,
  author TEXT,
  content_snippet TEXT,
  activity_url TEXT,
  human_task_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (publication_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_publications_tenant_project ON publications(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_publications_next_check ON publications(next_check_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_pub_activities_pub_id ON publication_activities(publication_id);
