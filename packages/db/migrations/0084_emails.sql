-- H1: thư viện email (active) để chọn khi tạo identity/account — KHÔNG dùng
-- email ngẫu nhiên. provider=gmail → hỗ trợ +tag (base+tag@gmail.com cùng inbox).
CREATE TABLE IF NOT EXISTS emails (
  id          bigserial PRIMARY KEY,
  tenant_id   text NOT NULL DEFAULT 'self',
  email       text NOT NULL,
  provider    text NOT NULL DEFAULT 'other',   -- gmail | catchall | other
  status      text NOT NULL DEFAULT 'active',  -- active | used | burned
  label       text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS emails_email_uniq ON emails (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON emails TO mos2;
GRANT USAGE, SELECT ON SEQUENCE emails_id_seq TO mos2;
