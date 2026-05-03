-- Per-member data scoping: project membership + entity ownership.
-- Operator chỉ thấy projects + entities (accounts/proxies/profiles/tribes) họ được assign.

-- Owner FKs trên các entity tenant-level. NULL = chưa assign cho ai (admin only).
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;
ALTER TABLE proxies            ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;
ALTER TABLE browser_profiles   ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;
ALTER TABLE tribes             ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;

CREATE INDEX IF NOT EXISTS accounts_owner_idx          ON platform_accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS proxies_owner_idx           ON proxies(owner_user_id);
CREATE INDEX IF NOT EXISTS browser_profiles_owner_idx  ON browser_profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS tribes_owner_idx            ON tribes(owner_user_id);

-- Project membership: members table already supports per-project rows
-- (project_id != NULL). Just need to seed admin as member of all existing projects
-- so they keep full access after this gate is added.
INSERT INTO members (tenant_id, user_id, project_id, role, display_name, specialty, active)
SELECT m.tenant_id, m.user_id, p.id, 'admin', m.display_name, m.specialty, m.active
FROM members m
CROSS JOIN projects p
WHERE m.project_id IS NULL
  AND m.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM members m2
    WHERE m2.user_id = m.user_id AND m2.project_id = p.id
  );
