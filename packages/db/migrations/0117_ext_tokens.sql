-- Per-user Crew ext token (Pha 2 staff ops). Token plaintext shown once; chỉ lưu sha256 hash.
-- Handover lifecycle tự derive: có row active = đã giao · last_seen_at = ext heartbeat (đang dùng) · revoked_at = thu hồi.
CREATE TABLE IF NOT EXISTS ext_tokens (
  id           serial PRIMARY KEY,
  tenant_id    text NOT NULL DEFAULT 'self',
  user_id      integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL,
  issued_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz
);
-- 1 token active / user
CREATE UNIQUE INDEX IF NOT EXISTS ext_tokens_active_user ON ext_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ext_tokens_hash ON ext_tokens(token_hash) WHERE revoked_at IS NULL;
