-- Phase 14: Team management — enrich members + add task assignment.
-- Goal: 1 founder + N team members, each gets per-user inbox.

-- Enrich members table: display name, specialty (which AI squad output goes to them), active flag
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT,           -- writer | community | designer | video | outreach | analytics | ops
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- human_tasks: assignment to a specific user
ALTER TABLE human_tasks
  ADD COLUMN IF NOT EXISTS assigned_user_id BIGINT;
CREATE INDEX IF NOT EXISTS human_tasks_assigned_idx ON human_tasks(assigned_user_id, status);

-- Seed: founder user "Hoàng Tuấn" + admin member if no users yet
INSERT INTO users (tenant_id, email, name, auth_kind)
SELECT 'self', 'admin@earns.local', 'Hoàng Tuấn (Founder)', 'session'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE tenant_id = 'self');

INSERT INTO members (tenant_id, user_id, project_id, role, display_name, specialty, active)
SELECT 'self', u.id, NULL, 'admin', 'Hoàng Tuấn', 'founder', true
FROM users u
WHERE u.tenant_id = 'self'
  AND NOT EXISTS (SELECT 1 FROM members m WHERE m.user_id = u.id AND m.project_id IS NULL);
