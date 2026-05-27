-- 0076 — Reddit insights bổ sung: top countries + top replies.
-- Insights page Reddit show:
--   - Top countries by views: list [{country, pct}] (vd Vietnam 78%, India 22%)
--   - Top replies: list [{author, ago, body, score}]
-- 2 trường này là leading indicator để tune content strategy theo
-- geography và xem ai engage trực tiếp.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS insights_top_countries jsonb,
  ADD COLUMN IF NOT EXISTS insights_top_replies jsonb;
