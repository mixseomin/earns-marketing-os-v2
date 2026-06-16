-- X (Twitter) Post Analytics — metric chỉ có trong modal Analytics, không có ở action bar inline:
-- Engagements, Detail expands, Profile visits. (Impressions→insights_views_count, Likes→insights_score,
-- Replies→insights_reply_count, Reposts→insights_share_count đã có.) Crew ext scrape modal → push.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS insights_engagements    integer;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS insights_detail_expands integer;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS insights_profile_visits integer;
