-- Phase 7 — Auto-check warmup: tag checklist items với 'auto' flag để
-- runWarmupAutoCheck biết item nào fetch được.
--
-- Pattern: jsonb_set on each item index. Idempotent vì fetch/build chỉ ghi
-- nếu key chưa tồn tại trong item.

DO $$
DECLARE
  rec RECORD;
  i INT;
  itm JSONB;
  new_arr JSONB;
BEGIN
  FOR rec IN
    SELECT key, checklist FROM platforms WHERE key IN ('reddit','hackernews','producthunt','twitter','bluesky')
  LOOP
    new_arr := '[]'::jsonb;
    FOR i IN 0..(jsonb_array_length(rec.checklist) - 1) LOOP
      itm := rec.checklist->i;
      IF rec.key = 'reddit' THEN
        IF itm->>'key' = 'karma' THEN itm := jsonb_set(itm, '{auto}', '"reddit-karma"'::jsonb, true); END IF;
        IF itm->>'key' = 'account_age_days' THEN itm := jsonb_set(itm, '{auto}', '"reddit-age"'::jsonb, true); END IF;
        IF itm->>'key' = 'organic_comments' THEN itm := jsonb_set(itm, '{auto}', '"reddit-comments"'::jsonb, true); END IF;
      ELSIF rec.key = 'hackernews' THEN
        IF itm->>'key' = 'karma' THEN itm := jsonb_set(itm, '{auto}', '"hn-karma"'::jsonb, true); END IF;
        IF itm->>'key' = 'account_age_days' THEN itm := jsonb_set(itm, '{auto}', '"hn-age"'::jsonb, true); END IF;
      ELSIF rec.key = 'bluesky' THEN
        IF itm->>'key' = 'followers' THEN itm := jsonb_set(itm, '{auto}', '"bluesky-followers"'::jsonb, true); END IF;
        IF itm->>'key' = 'posts_count' THEN itm := jsonb_set(itm, '{auto}', '"bluesky-posts"'::jsonb, true); END IF;
      END IF;
      new_arr := new_arr || itm;
    END LOOP;
    UPDATE platforms SET checklist = new_arr, updated_at = NOW() WHERE key = rec.key;
  END LOOP;
END $$;
