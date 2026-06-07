-- Per-habitat humanizer override (community_briefs = cặp account×habitat).
-- NULL = kế thừa humanizer của account (persona.humanizer). {knobs:[], intensity} = override.
ALTER TABLE community_briefs ADD COLUMN IF NOT EXISTS humanizer jsonb;
