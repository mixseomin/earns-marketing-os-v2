-- Profile-target = ĐÚNG 1 project chính (primary) / account. Account tham gia nhiều
-- project (junction primary|shared) nhưng persona/bio target 1 primary.

-- 1. Demote duplicate primaries (an toàn — giữ 1 primary/account: created_at sớm nhất).
WITH ranked AS (
  SELECT account_id, project_id,
         row_number() OVER (PARTITION BY account_id ORDER BY created_at, project_id) AS rn
  FROM project_accounts WHERE role = 'primary'
)
UPDATE project_accounts pa SET role = 'shared'
FROM ranked r
WHERE pa.account_id = r.account_id AND pa.project_id = r.project_id AND r.rn > 1;

-- 2. Enforce: đúng 1 primary / account (partial unique).
CREATE UNIQUE INDEX IF NOT EXISTS project_accounts_one_primary
  ON project_accounts (account_id) WHERE role = 'primary';

-- 3. Mirror legacy project_id = primary junction (profile-target).
UPDATE platform_accounts pa SET project_id = j.project_id
FROM project_accounts j
WHERE j.account_id = pa.id AND j.role = 'primary'
  AND (pa.project_id IS DISTINCT FROM j.project_id);
