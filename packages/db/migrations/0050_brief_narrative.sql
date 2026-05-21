-- Storytelling guidance ở brief level (per account × habitat).
-- narrative_md: markdown framework dẫn dắt content - cách kể chuyện, story arc,
-- hook patterns, voice DNA cho combo này. Tách biệt khỏi approachMd (chiến
-- thuật engagement) vì narrative là về CÁCH viết, không phải KHI/Ở ĐÂU đăng.
ALTER TABLE community_briefs
  ADD COLUMN IF NOT EXISTS narrative_md text NOT NULL DEFAULT '';
