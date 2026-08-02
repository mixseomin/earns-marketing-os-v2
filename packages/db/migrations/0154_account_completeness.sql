-- Account completeness enforcement (2026-08-02). Idempotent (safe to re-run each deploy).
--
-- Bug it fixes: platform_accounts.project_id is a DISPLAY/home scalar; the vault +
-- account pickers read project membership from the project_accounts JUNCTION. A raw
-- INSERT that set only the scalar left the account INVISIBLE under its project
-- (happened to acct 131 = the PCGS forum persona). These changes make that state
-- impossible and give one canonical creator so nobody hand-rolls a partial insert.

-- 1) Trigger: any account with a scalar project_id ALWAYS gets its junction row.
CREATE OR REPLACE FUNCTION sync_account_project() RETURNS trigger AS $fn$
BEGIN
  IF NEW.project_id IS NOT NULL AND NEW.project_id <> '' THEN
    -- role 'primary' only if the account has no home yet, else 'shared' — the
    -- partial-unique project_accounts_one_primary allows one primary per account.
    INSERT INTO project_accounts (project_id, account_id, role, content_ratio)
    VALUES (NEW.project_id, NEW.id,
      CASE WHEN EXISTS (SELECT 1 FROM project_accounts WHERE account_id = NEW.id AND role = 'primary')
           THEN 'shared' ELSE 'primary' END,
      100)
    ON CONFLICT (project_id, account_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_account_project ON platform_accounts;
CREATE TRIGGER trg_sync_account_project
AFTER INSERT OR UPDATE OF project_id ON platform_accounts
FOR EACH ROW EXECUTE FUNCTION sync_account_project();

-- 2) Backfill: every existing account with a scalar project but no junction row.
INSERT INTO project_accounts (project_id, account_id, role, content_ratio)
SELECT pa.project_id, pa.id, 'primary', 100
FROM platform_accounts pa
WHERE pa.project_id IS NOT NULL AND pa.project_id <> ''
  AND NOT EXISTS (SELECT 1 FROM project_accounts j WHERE j.project_id = pa.project_id AND j.account_id = pa.id)
ON CONFLICT (project_id, account_id) DO NOTHING;

-- 3) Canonical creator: one call → a COMPLETE, correct account. Encrypts the
--    password (pgcrypto, MOS2_SECRET_KEY passed as p_key), derives the project from
--    a task when p_project is null, sets P/B/S type, links the task, and (via the
--    trigger above) the junction. Callers: SELECT create_account('forums-collectors-com',
--    'handle','a@b.com','pw', :'key', NULL, 266, 'personal').
CREATE OR REPLACE FUNCTION create_account(
  p_platform text, p_handle text, p_email text, p_password text, p_key text,
  p_project text DEFAULT NULL, p_task_id bigint DEFAULT NULL,
  p_type text DEFAULT 'personal', p_status text DEFAULT 'warming',
  p_owner_name text DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS bigint AS $fn$
DECLARE v_project text; v_id bigint;
BEGIN
  v_project := COALESCE(p_project, (SELECT project_id FROM human_tasks WHERE id = p_task_id));
  INSERT INTO platform_accounts
    (tenant_id, project_id, platform_key, handle, email, status, auth_method,
     password_enc, account_type, persona_owner_name, notes, last_verified_at)
  VALUES
    ('self', v_project, p_platform, p_handle, p_email, p_status, 'password',
     CASE WHEN COALESCE(p_password, '') <> '' THEN encode(pgp_sym_encrypt(p_password, p_key), 'base64') END,
     COALESCE(p_type, 'personal'), p_owner_name, p_notes,
     CASE WHEN p_status = 'active' THEN now() ELSE NULL END)
  RETURNING id INTO v_id;
  IF p_task_id IS NOT NULL THEN UPDATE human_tasks SET account_id = v_id WHERE id = p_task_id; END IF;
  RETURN v_id;
END;
$fn$ LANGUAGE plpgsql;
