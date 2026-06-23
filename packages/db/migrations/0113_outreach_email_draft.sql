-- Persist the operator's edited email so a fix ("Hi there," -> "Hi Megan,") survives send + reopen.
-- Idempotent (file-runner). email_body NULL = fall back to the generated template.
ALTER TABLE outreach_prospects ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE outreach_prospects ADD COLUMN IF NOT EXISTS email_body text;
