-- identity_projects: 1 persona ↔ N projects (mirror project_accounts).
-- Thay cơ chế cũ "project_id IS NULL = global" (0118) bằng pivot tường minh:
-- user CHỌN project nào được dùng persona, không phải bật shared toàn portfolio.
CREATE TABLE IF NOT EXISTS identity_projects (
  project_id  text        NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  identity_id bigint      NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'shared',          -- 'primary' (home) | 'shared'
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, identity_id)
);
CREATE INDEX IF NOT EXISTS identity_projects_identity_idx ON identity_projects (identity_id);

-- Backfill: mỗi identity có project_id (home) → 1 hàng pivot 'primary'.
INSERT INTO identity_projects (project_id, identity_id, role)
SELECT project_id, id, 'primary' FROM identities WHERE project_id IS NOT NULL
ON CONFLICT (project_id, identity_id) DO NOTHING;
