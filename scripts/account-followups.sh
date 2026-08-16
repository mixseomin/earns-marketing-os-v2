#!/usr/bin/env bash
# List MOS2 accounts due for follow-up (pending verify/approval; follow_up_at reached).
# A fresh chat PULLS this to know which accounts to chase — nothing is pushed to Claude.
set -a; . /opt/earns-marketing-os-v2/.env.production 2>/dev/null; set +a
psql "$DATABASE_URL" -P pager=off <<'SQL'
\echo '=== DUE NOW (follow_up_at <= today) ==='
SELECT a.id, a.handle, a.platform_key AS platform, a.project_id AS project,
       a.status, a.follow_up_at::date AS due, (CURRENT_DATE - a.follow_up_at::date) AS overdue_d
FROM platform_accounts a
WHERE a.status IN ('warming','pending') AND a.follow_up_at IS NOT NULL AND a.follow_up_at::date <= CURRENT_DATE
ORDER BY a.follow_up_at;
\echo ''
\echo '=== UPCOMING (scheduled, not yet due) ==='
SELECT a.id, a.handle, a.platform_key AS platform, a.project_id AS project, a.follow_up_at::date AS due
FROM platform_accounts a
WHERE a.status IN ('warming','pending') AND a.follow_up_at IS NOT NULL AND a.follow_up_at::date > CURRENT_DATE
ORDER BY a.follow_up_at;
\echo ''
\echo 'RUNBOOK per due account (all steps are READ-ONLY except the final DB update — never re-submit a signup form):'
\echo '  1. Read-only check: open the persona Gmail (local .capture-profile) and search the platform name for an approval/verify mail; OR load the platform logged-in to see if the account is active.'
\echo '  2a. APPROVED  -> click the verify link, then: UPDATE platform_accounts SET status=''active'', last_verified_at=now(), follow_up_at=NULL WHERE id=<id>;'
\echo '  2b. STILL PENDING -> UPDATE platform_accounts SET follow_up_at=CURRENT_DATE+3 WHERE id=<id>;   (and leave the linked task in its submitted column)'
SQL
