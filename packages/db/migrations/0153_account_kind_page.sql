-- account_kind 'page' = FB Page identity (post AS Page; join & comment in FB groups AS the Page,
-- not a personal profile). FB-only in the UI (the Page button only renders when platformKey='facebook').
-- Applied manually on prod (the drizzle journal is frozen at 0025; numbered SQL here is the record).
ALTER TABLE platform_accounts DROP CONSTRAINT IF EXISTS platform_accounts_account_kind_chk;
ALTER TABLE platform_accounts ADD CONSTRAINT platform_accounts_account_kind_chk
  CHECK (account_kind IN ('user', 'bot', 'app', 'page'));

-- Backfill: existing facebook brand accounts ARE Pages, EXCEPT group personas (handle grp-*).
UPDATE platform_accounts SET account_kind = 'page', updated_at = now()
WHERE tenant_id = 'self' AND platform_key = 'facebook' AND account_type = 'brand'
  AND account_kind = 'user' AND handle NOT LIKE 'grp-%';
