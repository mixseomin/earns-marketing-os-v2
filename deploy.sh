#!/bin/bash
# MOS v2 deploy — runs on as.on.tc co-host server, triggered by GitHub Actions.
set -euo pipefail

cd /opt/earns-marketing-os-v2

set -a
[ -f .env.production ] && source .env.production
set +a

echo "── MOS v2 deploy ── $(date -Iseconds) ──"

# 1. Pre-deploy DB backup (best-effort)
PG_BACKUP_FILE="/backup/mos2-pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz"
mkdir -p /backup
if pg_dump -U mos2 mos2_prod 2>/dev/null | gzip > "$PG_BACKUP_FILE"; then
  echo "✓ DB backup: $PG_BACKUP_FILE"
else
  echo "⚠ DB backup skipped (no DB yet)"
  rm -f "$PG_BACKUP_FILE"
fi

# 2. Pull latest from git
PREV_SHA=$(git rev-parse HEAD)
git fetch origin main
git reset --hard origin/main
NEW_SHA=$(git rev-parse HEAD)
echo "✓ Code: $PREV_SHA → $NEW_SHA"

# 3. Install deps if package.json or lockfile changed
DEPS_CHANGED=false
if [ "$PREV_SHA" != "$NEW_SHA" ] && git diff "$PREV_SHA" "$NEW_SHA" --name-only | grep -qE "^(package\.json|package-lock\.json|.*/package\.json)$"; then
  DEPS_CHANGED=true
  npm ci --prefer-offline --no-audit --no-fund --production=false
  echo "✓ Deps installed (changed)"
else
  echo "↺ Skip deps (no package changes)"
fi

# 4. Apply pending Drizzle migrations (idempotent — safe to run every deploy)
if [ -d "packages/db/migrations" ]; then
  npm run db:migrate
  echo "✓ DB migrations applied"
fi

# 4b. Optional one-shot seed: enable by setting MOS2_AUTO_SEED=1 in .env.production
if [ "${MOS2_AUTO_SEED:-0}" = "1" ]; then
  npm run db:seed
  echo "✓ DB seeded (MOS2_AUTO_SEED=1)"
fi

# 5. Build only if web src changed
WEB_CHANGED=false
if [ "$PREV_SHA" != "$NEW_SHA" ] && git diff "$PREV_SHA" "$NEW_SHA" --name-only | grep -qE "^apps/web/"; then
  WEB_CHANGED=true
fi
if [ "$WEB_CHANGED" = "true" ] || [ "$DEPS_CHANGED" = "true" ] || [ ! -d "apps/web/.next" ]; then
  npm run build:web
  echo "✓ Web build done"
else
  echo "↺ Skip build (no source changes)"
fi

# 6. Restart systemd unit
systemctl restart mos2-web
sleep 1
systemctl is-active mos2-web && echo "✓ mos2-web active" || (echo "✗ mos2-web failed"; systemctl status mos2-web --no-pager | tail -20; exit 1)

echo "── deploy complete ──"
