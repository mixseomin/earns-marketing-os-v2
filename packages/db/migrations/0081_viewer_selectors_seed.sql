-- 0081: seed selector_overrides cho viewer.logged_in + viewer.handle
-- (page_kind='platform-any', scope='platform'). Reuse selector_overrides
-- pipeline thay vì tạo column riêng — ext call learn-selectors endpoint
-- giống habitat/brief fields, sidepanel train UI cũng dùng chung.
--
-- Selector seed = copy từ content.js v1.5.46 VIEWER_RESOLVERS hardcoded.
-- User update tiếp qua ext train UI (save-selector / train-selector).
--
-- KHÔNG ON CONFLICT — pipeline đã tự dedupe via uniqueIndex
-- (tenant_id, scope_kind, scope_key, page_kind, field_name).

INSERT INTO selector_overrides
  (tenant_id, scope_kind, scope_key, page_kind, field_name, spec, source, confidence, created_at, updated_at)
VALUES
  -- Reddit
  ('self', 'platform', 'reddit',    'platform-any', 'viewer.logged_in',
   '{"css":"faceplate-dropdown[noun=\"user_menu\"]","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),

  -- Discord — multi-fallback (panel avatarWrapper / nameTag / settings aria)
  ('self', 'platform', 'discord',   'platform-any', 'viewer.logged_in',
   '{"css":"section[class*=\"panel\"] [class*=\"avatarWrapper\"]","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),

  -- X / Twitter
  ('self', 'platform', 'x',         'platform-any', 'viewer.logged_in',
   '{"css":"a[data-testid=\"AppTabBar_Profile_Link\"]","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),
  ('self', 'platform', 'x',         'platform-any', 'viewer.handle',
   '{"css":"a[data-testid=\"AppTabBar_Profile_Link\"]","attr":"href","parse":"text","kind":"css","transform_regex":"^/([A-Za-z0-9_]+)$","transform_replace":"$1"}', 'manual', 50, now(), now()),

  -- LinkedIn
  ('self', 'platform', 'linkedin',  'platform-any', 'viewer.logged_in',
   '{"css":".global-nav__me","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),

  -- Facebook
  ('self', 'platform', 'facebook',  'platform-any', 'viewer.logged_in',
   '{"css":"a[href=\"/me/\"]","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),

  -- Instagram
  ('self', 'platform', 'instagram', 'platform-any', 'viewer.logged_in',
   '{"css":"a[href=\"/accounts/edit/\"]","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),

  -- Threads
  ('self', 'platform', 'threads',   'platform-any', 'viewer.logged_in',
   '{"css":"nav a[href^=\"/@\"]","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),
  ('self', 'platform', 'threads',   'platform-any', 'viewer.handle',
   '{"css":"nav a[href^=\"/@\"]","attr":"href","parse":"text","kind":"css","transform_regex":"^/@([A-Za-z0-9_.]+)","transform_replace":"$1"}', 'manual', 50, now(), now()),

  -- YouTube
  ('self', 'platform', 'youtube',   'platform-any', 'viewer.logged_in',
   '{"css":"button#avatar-btn","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),

  -- TikTok
  ('self', 'platform', 'tiktok',    'platform-any', 'viewer.logged_in',
   '{"css":"[data-e2e=\"profile-icon\"]","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),

  -- Substack
  ('self', 'platform', 'substack',  'platform-any', 'viewer.logged_in',
   '{"css":".user-head","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),

  -- Pinterest
  ('self', 'platform', 'pinterest', 'platform-any', 'viewer.logged_in',
   '{"css":"[data-test-id=\"header-profile\"]","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now()),

  -- Bsky
  ('self', 'platform', 'bsky',      'platform-any', 'viewer.logged_in',
   '{"css":"a[aria-label=\"Profile\" i]","attr":"exists","parse":"bool","kind":"css"}', 'manual', 50, now(), now())
ON CONFLICT (tenant_id, scope_kind, scope_key, page_kind, field_name) DO NOTHING;
