-- Allow MULTIPLE touches of the same channel per prospect (FB 1, FB 2, …). You can't always find the one
-- right contact point, so you try several profiles/pages of the same channel. Drop the (prospect_id, channel)
-- unique so add-touch inserts a fresh row each time instead of upserting onto the first.
DROP INDEX IF EXISTS outreach_touches_prospect_channel_uidx;
