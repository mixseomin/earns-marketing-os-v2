-- "Comment/DM as" — record WHICH identity/account a social touch was sent as (FB comment-as-Page,
-- X/LinkedIn/IG profile, seeding persona…). Generic jsonb so it fits any channel: {kind:'account'|
-- 'identity', id, label}. Chosen at send time; shown in the touch history. See multichannel plan.
ALTER TABLE outreach_touches ADD COLUMN IF NOT EXISTS sent_as jsonb NOT NULL DEFAULT '{}'::jsonb;
