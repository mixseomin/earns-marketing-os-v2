#!/usr/bin/env bash
# List browser-profile ASSETS + projects assigned + what is logged in inside + how stale each is.
# A fresh chat PULLS this to know: which project(s) a profile serves, where to open it, which
# accounts have live sessions in it, and which profiles need re-opening before sessions expire.
set -a; . /opt/earns-marketing-os-v2/.env.production 2>/dev/null; set +a
psql "$DATABASE_URL" -P pager=off <<'SQL'
\echo '=== BROWSER PROFILES (assets) ==='
SELECT bp.id, bp.label, bp.tool,
       COALESCE((SELECT string_agg(project_id, ',' ORDER BY project_id) FROM project_browser_profiles j WHERE j.browser_profile_id=bp.id), '(none)') AS projects,
       bp.external_id AS open_from,
       (CURRENT_DATE - bp.last_opened_at::date) AS idle_d,
       COALESCE(
         string_agg(pa.handle || '@' || pa.platform_key || ' (' || pa.status || ')', ', ')
           FILTER (WHERE pa.status NOT IN ('blocked','banned','dormant','defunct')),
         '(no live app-account)')
       || COALESCE(' · 🚫' || NULLIF(count(*) FILTER (WHERE pa.status IN ('blocked','banned','dormant','defunct')), 0)::text || ' banned/blocked (parked)', '')
       AS accounts_inside
FROM browser_profiles bp
LEFT JOIN platform_accounts pa ON pa.browser_profile_id = bp.id
WHERE bp.archived_at IS NULL
GROUP BY bp.id
ORDER BY bp.last_opened_at NULLS FIRST;
\echo ''
\echo 'HOW TO OPEN (any chat): launch external_id path via Playwright chromium.launchPersistentContext(channel=chrome) with the STEALTH flags in memory reference_local_playwright_automation (ignoreDefaultArgs[--enable-automation] + --disable-blink-features=AutomationControlled + navigator.webdriver=undefined). Base Google login + the app accounts above all live inside that profile dir.'
\echo 'SESSION MAINTENANCE: idle_d high = logins may be expiring. Re-open the profile READ-ONLY (load gmail + platform tabs), then bump last_opened_at. projects = which project(s) this browser is bound to (many-to-many).'
SQL
