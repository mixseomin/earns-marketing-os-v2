-- 0081: platforms.viewer_selectors — user-editable DOM selectors cho ext
-- login detection. Khi platform đổi DOM → user chỉnh selector trong DB
-- không cần rebuild ext.
--
-- Shape: { login: string[], handle: string[] }
--   login:  selectors check element CHỈ tồn tại khi đã login (avatar
--           dropdown, profile link, settings…). Array để fallback chain.
--   handle: optional, selectors extract username từ DOM (href hoặc text).
--           Element value parse theo prefix '@' / '/' / text content.
--
-- Ext fetch GET /api/ext/platforms/selectors khi inject → cache local →
-- loginProbe() chạy `selector.some(s => document.querySelector(s))`.

ALTER TABLE platforms ADD COLUMN IF NOT EXISTS viewer_selectors jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed selectors hiện tại (sao y từ content.js v1.5.46) cho 12 platforms
UPDATE platforms SET viewer_selectors = '{
  "login": [
    "faceplate-dropdown[noun=\"user_menu\"]",
    "button[aria-label*=\"Account menu\"]"
  ]
}'::jsonb WHERE key = 'reddit';

UPDATE platforms SET viewer_selectors = '{
  "login": [
    "section[class*=\"panel\"] [class*=\"avatarWrapper\"]",
    "section[class*=\"panel\"] [class*=\"nameTag\"]",
    "[aria-label=\"User Settings\"]"
  ]
}'::jsonb WHERE key = 'discord';

UPDATE platforms SET viewer_selectors = '{
  "login": [
    "a[data-testid=\"AppTabBar_Profile_Link\"]",
    "[data-testid=\"SideNav_AccountSwitcher_Button\"]"
  ],
  "handle": ["a[data-testid=\"AppTabBar_Profile_Link\"]"]
}'::jsonb WHERE key IN ('x', 'twitter');

UPDATE platforms SET viewer_selectors = '{
  "login": [".global-nav__me", "a.global-nav__me-photo"],
  "handle": ["a.global-nav__me-photo"]
}'::jsonb WHERE key = 'linkedin';

UPDATE platforms SET viewer_selectors = '{
  "login": ["a[href=\"/me/\"]", "[aria-label*=\"Your profile\" i]"]
}'::jsonb WHERE key = 'facebook';

UPDATE platforms SET viewer_selectors = '{
  "login": ["a[href=\"/accounts/edit/\"]"]
}'::jsonb WHERE key = 'instagram';

UPDATE platforms SET viewer_selectors = '{
  "login": ["nav a[href^=\"/@\"]"],
  "handle": ["nav a[href^=\"/@\"]"]
}'::jsonb WHERE key = 'threads';

UPDATE platforms SET viewer_selectors = '{
  "login": ["button#avatar-btn", "ytd-active-account-header-renderer"]
}'::jsonb WHERE key = 'youtube';

UPDATE platforms SET viewer_selectors = '{
  "login": ["[data-e2e=\"profile-icon\"]", "[data-e2e=\"nav-profile\"]"],
  "handle": ["a[data-e2e=\"nav-profile\"]"]
}'::jsonb WHERE key = 'tiktok';

UPDATE platforms SET viewer_selectors = '{
  "login": [".user-head", ".reader2-user-name"]
}'::jsonb WHERE key = 'substack';

UPDATE platforms SET viewer_selectors = '{
  "login": ["[data-test-id=\"header-profile\"]"],
  "handle": ["a[data-test-id=\"header-profile\"]"]
}'::jsonb WHERE key = 'pinterest';

UPDATE platforms SET viewer_selectors = '{
  "login": ["a[aria-label=\"Profile\" i]", "[data-testid=\"composeFAB\"]"],
  "handle": ["a[aria-label=\"Profile\" i]"]
}'::jsonb WHERE key = 'bsky';
