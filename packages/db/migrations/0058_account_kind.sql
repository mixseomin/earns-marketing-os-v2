-- 0058: phân biệt user account vs bot/app account
--
-- Bối cảnh: Discord/Slack/Telegram (và một số platform khác) có 2 loại account:
--   1. User account: handle/email/password, login manual, join server qua
--      invite link, post manual (copy/paste). Cần warming (đủ tuổi + reactions).
--   2. Bot/app account: client_id + bot_token (long-lived secret), được
--      invite vào server qua OAuth scope `bot`, post programmatic qua API/
--      webhook. KHÔNG cần warming, không có persona/voice, ít risk shadowban.
--
-- Logic gate khác hẳn (xem brief-readiness):
--   - User: status active + joinStatus joined + warmupChecklist
--   - Bot:  status active = có bot_token + server admin grant scope
--           (joinStatus='joined' = bot đã được invited; warming irrelevant)

ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS account_kind text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS bot_token_enc bytea;

-- Constraint check (text + check, không phải pg enum, để dễ extend sau)
ALTER TABLE platform_accounts
  DROP CONSTRAINT IF EXISTS platform_accounts_account_kind_chk;
ALTER TABLE platform_accounts
  ADD CONSTRAINT platform_accounts_account_kind_chk
    CHECK (account_kind IN ('user', 'bot', 'app'));

CREATE INDEX IF NOT EXISTS platform_accounts_account_kind_idx
  ON platform_accounts(account_kind);

-- Comment cho documentation
COMMENT ON COLUMN platform_accounts.account_kind IS
  'user = manual login account; bot = Discord/Slack bot account; app = OAuth integration app (Reddit script-app, etc.)';
COMMENT ON COLUMN platform_accounts.client_id IS
  'Bot/app client ID (Discord application ID, Slack App ID, Reddit script-app client_id)';
COMMENT ON COLUMN platform_accounts.bot_token_enc IS
  'pgcrypto-encrypted bot token (long-lived secret). NULL cho user accounts.';

-- Grant cho mos2 runtime user (xem feedback_mos2_grant_new_tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_accounts TO mos2;
