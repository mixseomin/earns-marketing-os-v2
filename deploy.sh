#!/bin/bash
# MOS v2 deploy — runs on as.on.tc co-host server, triggered by GitHub Actions.
set -euo pipefail

cd /opt/earns-marketing-os-v2

set -a
[ -f .env.production ] && source .env.production
set +a

echo "── MOS v2 deploy ── $(date -Iseconds) ──"

# DB backup moved to daily cron at /etc/cron.daily/mos2-backup (saved 5-15s/deploy).
# To force a backup-before-deploy: `MOS2_BACKUP=1 ./deploy.sh`.
if [ "${MOS2_BACKUP:-0}" = "1" ]; then
  PG_BACKUP_FILE="/backup/mos2-pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz"
  mkdir -p /backup
  pg_dump -U mos2 mos2_prod 2>/dev/null | gzip > "$PG_BACKUP_FILE" && echo "✓ DB backup: $PG_BACKUP_FILE" || rm -f "$PG_BACKUP_FILE"
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

# 4. Apply pending Drizzle migrations (idempotent — safe to run every deploy).
# Drizzle migrator chỉ apply migrations có trong meta/_journal.json. Journal
# stuck ở 0024 — mọi migration 0025+ phải tự apply qua file-based runner ở
# step 4a (idempotent vì các .sql files dùng "IF NOT EXISTS" pattern).
if [ -d "packages/db/migrations" ]; then
  npm run db:migrate
  echo "✓ DB migrations applied (drizzle journal)"
fi

# 4a. File-based migration runner — pick up mọi .sql file mới (0025+) mà
# drizzle journal không track. Track đã apply qua bảng _file_migrations.
if [ -n "${DATABASE_URL:-}" ] && [ -d "packages/db/migrations" ]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
    CREATE TABLE IF NOT EXISTS _file_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  " >/dev/null
  for sql_file in packages/db/migrations/[0-9][0-9][0-9][0-9]_*.sql; do
    [ -f "$sql_file" ] || continue
    fname=$(basename "$sql_file")
    already=$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM _file_migrations WHERE filename = '$fname' LIMIT 1")
    if [ "$already" = "1" ]; then
      continue
    fi
    echo "→ Applying $fname"
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql_file"; then
      psql "$DATABASE_URL" -c "INSERT INTO _file_migrations (filename) VALUES ('$fname') ON CONFLICT DO NOTHING;" >/dev/null
      echo "  ✓ $fname applied + recorded"
    else
      echo "  ✗ $fname failed — abort deploy"
      exit 1
    fi
  done
  echo "✓ File-based migrations up-to-date"
fi

# 4b. Run seed ONLY if seed files changed (packages/db/src/seed*) or first run
#     (no _seed_ran marker). Saves 5-15s when only app code changed.
#     If MOS2_AUTO_SEED=1, force seed (also wipes+reseeds demo projects).
SEED_NEEDED=false
if [ "${MOS2_AUTO_SEED:-0}" = "1" ]; then
  SEED_NEEDED=true
elif [ ! -f .next/.seed_ran ]; then
  SEED_NEEDED=true
elif [ "$PREV_SHA" != "$NEW_SHA" ] && git diff "$PREV_SHA" "$NEW_SHA" --name-only | grep -qE "^packages/db/src/seed"; then
  SEED_NEEDED=true
fi
if [ "$SEED_NEEDED" = "true" ]; then
  npm run db:seed
  mkdir -p .next && touch .next/.seed_ran
  echo "✓ DB seed completed (destructive=${MOS2_AUTO_SEED:-0})"
else
  echo "↺ Skip seed (no seed file changes)"
fi

# 5. Build only if web src changed
WEB_CHANGED=false
if [ "$PREV_SHA" != "$NEW_SHA" ] && git diff "$PREV_SHA" "$NEW_SHA" --name-only | grep -qE "^apps/web/"; then
  WEB_CHANGED=true
fi
if [ "$WEB_CHANGED" = "true" ] || [ "$DEPS_CHANGED" = "true" ] || [ ! -f "apps/web/.next/BUILD_ID" ]; then
  # Guard: unquoted camelCase SQL aliases (Postgres lowercases → row read returns null). Cheap, fail-fast.
  node scripts/check-sql-aliases.mjs || { echo "✗ SQL alias guard failed — abort deploy"; exit 1; }
  # Guard: behavioral-canon single-source (account slug must canon, selector_overrides one write-path).
  # Stops the 3 P0 drift classes from recurring in a brand-new chat. See lib/canon + decision 2026-06-25.
  node scripts/check-canon.mjs || { echo "✗ Behavioral-canon guard failed — abort deploy"; exit 1; }
  # heap-cap: box 4GB swap-tight → next build worker bị OS OOM-kill (SIGKILL). Cap để node GC sớm +
  # fail gracefully thay vì SIGKILL. ~3GB đủ (đã verify build lọt). Bỏ khi nâng RAM (CX33 8GB).
  NODE_OPTIONS="--max-old-space-size=3072" npm run build:web
  echo "✓ Web build done"
else
  echo "↺ Skip build (no source changes)"
fi

# 6. Restart systemd unit
systemctl restart mos2-web
sleep 1
systemctl is-active mos2-web && echo "✓ mos2-web active" || (echo "✗ mos2-web failed"; systemctl status mos2-web --no-pager | tail -20; exit 1)

echo "── deploy complete ──"
