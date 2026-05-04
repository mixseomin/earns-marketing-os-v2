-- 0038_account_share_and_profile_url.sql
-- 2 tính năng:
-- 1. platforms.profile_url_pattern — admin có thể override pattern URL profile
--    cho từng platform (vd: 'https://www.reddit.com/user/{handle}')
-- 2. account_grants — share 1 account cho NHIỀU entity (agent + human khác)
--    ngoài owner_user_id chính. Vd: account Reddit owner = Hoàng Tuấn,
--    nhưng share cho agent RES-04 + human Linh để cùng dùng.

-- ── Part 1: profile_url_pattern ──────────────────────────────────
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS profile_url_pattern text;
COMMENT ON COLUMN platforms.profile_url_pattern IS
  'URL pattern dẫn tới user profile public page. {handle} là placeholder. Vd: https://www.reddit.com/user/{handle}. NULL = chưa set, fallback sang hardcoded helper trong app code.';

-- ── Part 2: account_grants ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_grants (
  id           bigserial PRIMARY KEY,
  tenant_id    text NOT NULL DEFAULT 'self',
  account_id   bigint NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  grantee_kind text NOT NULL CHECK (grantee_kind IN ('agent', 'user')),
  grantee_id   text NOT NULL,   -- agent_ref (vd 'RES-04') khi kind='agent', user_id::text khi kind='user'
  role         text NOT NULL DEFAULT 'use',  -- 'use' | 'admin' (admin = có thể đổi setting)
  notes        text,
  granted_at   timestamptz NOT NULL DEFAULT NOW(),
  granted_by   bigint,  -- user_id của admin grant (audit)
  UNIQUE(account_id, grantee_kind, grantee_id)
);
CREATE INDEX IF NOT EXISTS account_grants_account_idx ON account_grants(account_id);
CREATE INDEX IF NOT EXISTS account_grants_grantee_idx ON account_grants(grantee_kind, grantee_id);
COMMENT ON TABLE account_grants IS
  'Share 1 account cho nhiều entity (agent + user) ngoài owner chính. Owner = đã có ở platform_accounts.owner_user_id. Grant này chỉ thêm quyền sử dụng.';
