-- Account persona: character brief for pre-deployment prep.
-- Stores DOB, gender, country, backstory, interests etc. — mirrors effective
-- signup_fields of the linked platform so operator knows what to prepare.
ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS persona JSONB NOT NULL DEFAULT '{}';
