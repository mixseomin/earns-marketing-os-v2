-- 0039_community_briefs.sql
-- Per (account × habitat) approach plan.
-- Background: each project negotiates many platforms; on each platform may
-- engage in many concrete communities (subreddit, FB group, Discord server).
-- Different account-personas need different tones. This table stores the
-- "phương án tiếp cận" for one persona engaging in one community.

CREATE TABLE IF NOT EXISTS community_briefs (
  id           bigserial PRIMARY KEY,
  tenant_id    text NOT NULL DEFAULT 'self',
  project_id   text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id   bigint NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  habitat_id   bigint NOT NULL REFERENCES habitats(id) ON DELETE CASCADE,
  approach_md  text NOT NULL DEFAULT '',
  cadence      text NOT NULL DEFAULT '',
  tone         text NOT NULL DEFAULT '',
  do_md        text NOT NULL DEFAULT '',
  dont_md      text NOT NULL DEFAULT '',
  templates    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, habitat_id)
);

CREATE INDEX IF NOT EXISTS community_briefs_project_idx ON community_briefs(project_id);
CREATE INDEX IF NOT EXISTS community_briefs_account_idx ON community_briefs(account_id);
CREATE INDEX IF NOT EXISTS community_briefs_habitat_idx ON community_briefs(habitat_id);
CREATE INDEX IF NOT EXISTS community_briefs_tenant_idx ON community_briefs(tenant_id);
