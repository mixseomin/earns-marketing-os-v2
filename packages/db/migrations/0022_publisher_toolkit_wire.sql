-- Phase 12 — Publisher toolkit wire vào library_tools.
-- runtime_module = 'toolkits/publisher' khớp lib/toolkits/publisher.ts.

INSERT INTO library_tools (id, tenant_id, name, description, category, icon, requires_env, status, runtime_module, side_effect, sort_order)
VALUES
  ('reddit-post',     'self', 'Reddit Post',
   'Submit text/link post to subreddit. Hiện tại fallback queue human_task vì script-app token KHÔNG submit được — cần user OAuth refresh token. Future: wire khi flow user-OAuth done.',
   'platform', '🔴', 'REDDIT_CLIENT_ID', 'integrated', 'toolkits/publisher', 'write', 70),

  ('twitter-post',    'self', 'Twitter / X Post',
   'Tweet text + optional reply/media. Hiện tại fallback human_task vì Twitter API v2 paid tier required. Future: wire OAuth1 user tokens.',
   'platform', '🐦', NULL, 'integrated', 'toolkits/publisher', 'write', 71),

  ('human-handoff',   'self', 'Human Handoff (queue)',
   'Generic fallback: tạo human_task khi platform requires_human=true (FB/IG/TikTok DM). AI prep payload (caption + media + hashtags + best-time hint), human nhận task qua /inbox, đăng + screenshot.',
   'comms', '👤', NULL, 'integrated', 'toolkits/publisher', 'write', 72)
ON CONFLICT (id) DO UPDATE SET
  runtime_module = EXCLUDED.runtime_module,
  side_effect = EXCLUDED.side_effect,
  status = 'integrated',
  description = EXCLUDED.description,
  updated_at = NOW();
