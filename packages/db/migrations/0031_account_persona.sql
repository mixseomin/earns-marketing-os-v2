-- Account persona model: 1 brand main + N team members posting under real names
-- with brand affiliation disclosure (legally clean per FTC/EU DSA — transparent advocacy).

ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS persona_kind TEXT NOT NULL DEFAULT 'brand'
    CHECK (persona_kind IN ('brand', 'employee', 'ambassador', 'synthetic')),
  ADD COLUMN IF NOT EXISTS persona_owner_name TEXT,                 -- real name for employee/ambassador
  ADD COLUMN IF NOT EXISTS persona_role TEXT,                       -- Founder / Engineer / Community / Marketing
  ADD COLUMN IF NOT EXISTS persona_bio TEXT,                        -- profile bio template
  ADD COLUMN IF NOT EXISTS disclosure_text TEXT,                    -- "Founder @ Astrolas — opinions my own"
  ADD COLUMN IF NOT EXISTS represents_account_id BIGINT
    REFERENCES platform_accounts(id) ON DELETE SET NULL;             -- link team-member acc → brand main acc

CREATE INDEX IF NOT EXISTS accounts_persona_kind_idx ON platform_accounts(persona_kind);
CREATE INDEX IF NOT EXISTS accounts_represents_idx   ON platform_accounts(represents_account_id);

-- Backfill: existing accounts default to persona_kind='brand'
UPDATE platform_accounts SET persona_kind = 'brand' WHERE persona_kind IS NULL OR persona_kind = '';
