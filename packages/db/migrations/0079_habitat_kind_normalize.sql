-- 0079: chuẩn hoá habitats.kind về dạng 1-từ ngắn
-- Trước: lẫn lộn (subreddit + forum + discord lẫn với discord-server,
-- hashtag-community, professional-org). User feedback: "sao ko đồng nhất
-- chọn 1 cái cho đỡ rối về sau".
--
-- Sau: tất cả 1 từ.
--   discord-server      → discord  (11 rows)
--   hashtag-community   → hashtag  (1 row)
--   professional-org    → org      (1 row)
-- Giữ nguyên: subreddit, forum, cafe, feed, group, hashtag, discord, fb-group
-- (fb-group compound NHƯNG distinguish fb-page sau này — exception duy nhất).

UPDATE habitats SET kind = 'discord',  updated_at = now() WHERE kind = 'discord-server';
UPDATE habitats SET kind = 'hashtag',  updated_at = now() WHERE kind = 'hashtag-community';
UPDATE habitats SET kind = 'org',      updated_at = now() WHERE kind = 'professional-org';

-- Cards.brief_phase + community_briefs.* etc. KHÔNG động (independent từ habitats.kind).
