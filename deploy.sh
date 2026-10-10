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

# 5. Web build.
# SKIP_BUILD=1 (set by GitHub Actions) = the runner ALREADY built .next and shipped it to
# apps/web/.next.new (build-on-runner since the 2026-06-28 box-OOM incident). Swap it in — do NOT
# rebuild on the box. Rebuilding here was a DOUBLE build: ~40s wasted every deploy AND it re-exposed the
# OOM risk the runner-move was meant to remove. The SQL-alias + canon guards already ran on the runner
# before that build, so they are not re-run here. Manual `./deploy.sh` (no SKIP_BUILD) still builds on
# the server via the fallback below.
if [ "${SKIP_BUILD:-0}" = "1" ] && [ -f apps/web/.next.new/BUILD_ID ]; then
  rm -rf apps/web/.next.old
  [ -e apps/web/.next ] && mv apps/web/.next apps/web/.next.old   # two renames = sub-ms gap; restart follows
  mv apps/web/.next.new apps/web/.next
  rm -rf apps/web/.next.old
  echo "✓ Web build swapped in (prebuilt on runner — no server rebuild)"
else
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
    # Guard: tab cấp trang phải khai ở lib/tab-trang.ts (sidebar tự sinh mục con) — anh chốt 01/10/2026.
    node scripts/check-tab-trang.mjs || { echo "✗ Tab-trang guard failed — abort deploy"; exit 1; }
    # Guard: file 'use client' không được kéo DB/fs (next build gãy) — dính 01/10/2026 ở màn hồ sơ /shop.
    node scripts/check-client-db.mjs || { echo "✗ Client-DB guard failed — abort deploy"; exit 1; }
    # heap-cap: box 4GB swap-tight → next build worker bị OS OOM-kill (SIGKILL). Cap để node GC sớm +
    # fail gracefully thay vì SIGKILL. ~3GB đủ (đã verify build lọt). Bỏ khi nâng RAM (CX33 8GB).
    NODE_OPTIONS="--max-old-space-size=3072" npm run build:web
    echo "✓ Web build done"
  else
    echo "↺ Skip build (no source changes)"
  fi
fi

# 5b. Mặt tiền shop (apps/store, cổng 3830, mos2-store.service) — khách thật đang mua trên đó: CHỈ đổi bản dựng + khởi động lại
#     khi phần của nó đổi (apps/store, packages/shop, packages/db, deps), không giật theo mọi lượt đẩy của MOS2.
STORE_CHANGED=false
if [ "$PREV_SHA" != "$NEW_SHA" ] && git diff "$PREV_SHA" "$NEW_SHA" --name-only | grep -qE "^(apps/store/|packages/shop/|packages/db/src/|package-lock\.json)"; then
  STORE_CHANGED=true
fi
if [ -f apps/store/.next.new/BUILD_ID ] && { [ "$STORE_CHANGED" = "true" ] || [ "$DEPS_CHANGED" = "true" ] || [ ! -f apps/store/.next/BUILD_ID ]; }; then
  rm -rf apps/store/.next.old
  [ -e apps/store/.next ] && mv apps/store/.next apps/store/.next.old
  mv apps/store/.next.new apps/store/.next
  rm -rf apps/store/.next.old
  if systemctl cat mos2-store >/dev/null 2>&1; then
    systemctl restart mos2-store; sleep 1
    systemctl is-active mos2-store && echo "✓ mos2-store active" || { echo "✗ mos2-store failed"; systemctl status mos2-store --no-pager | tail -20; exit 1; }
  fi
else
  rm -rf apps/store/.next.new
  echo "↺ Store unchanged — keep running build"
fi

# 5d. xv-worker (Cloudflare Worker Astrolas, consumer hàng đợi xv-jobs) — deploy TRƯỚC khi thay build studio: studio mới đẩy việc
#     vào hàng đợi, Worker phải có sẵn để nhận. Chỉ chạy khi mã Worker / lib sinh ảnh đổi hoặc Worker chưa từng lên (dấu ở .xv-worker-sha).
XVW_SHA=$(git log -1 --format=%H -- apps/xuong-video/worker apps/xuong-video/src/lib/xuong-video apps/xuong-video/src/lib/r2.ts)
if [ "$XVW_SHA" != "$(cat .xv-worker-sha 2>/dev/null)" ]; then
  if bash apps/xuong-video/worker/deploy.sh; then echo "$XVW_SHA" > .xv-worker-sha; else echo "✗ xv-worker deploy lỗi — studio vẫn chạy, việc ảnh tự chạy nội bộ khi hàng đợi không nhận"; fi
fi

# 5c. Xưởng video (apps/xuong-video, cổng 3840, mos2-studio.service, studio.on.tc) — app riêng trên subdomain on.tc (anh chốt 08/10/2026).
#     Unit + vhost nginx cài từ repo (deploy/mos2-studio.service, deploy/nginx-studio.conf) để không ai phải ssh gõ tay; idempotent.
if ! cmp -s deploy/mos2-studio.service /etc/systemd/system/mos2-studio.service; then
  cp deploy/mos2-studio.service /etc/systemd/system/mos2-studio.service && systemctl daemon-reload && systemctl enable mos2-studio >/dev/null 2>&1 && echo "✓ mos2-studio unit cài/cập nhật"
fi
if ! cmp -s deploy/nginx-studio.conf /etc/nginx/sites-enabled/studio.on.tc; then
  cp deploy/nginx-studio.conf /etc/nginx/sites-enabled/studio.on.tc && nginx -t >/dev/null 2>&1 && systemctl reload nginx && echo "✓ nginx studio.on.tc cài/cập nhật" || { echo "✗ nginx studio.on.tc: cấu hình lỗi"; rm -f /etc/nginx/sites-enabled/studio.on.tc; }
fi
STUDIO_CHANGED=false
if [ "$PREV_SHA" != "$NEW_SHA" ] && git diff "$PREV_SHA" "$NEW_SHA" --name-only | grep -qE "^(apps/xuong-video/|packages/db/src/|package-lock\.json)"; then
  STUDIO_CHANGED=true
fi
# Luôn thay khi artifact mới khác bản đang chạy: so git diff PREV..NEW hỏng khi hai lượt deploy chồng nhau (lượt trước đã kéo code
# mới nhưng thay build CŨ, lượt sau thấy PREV==NEW nên bỏ qua → máy chạy build cũ, 08/10/2026 bản sửa keyframe không lên).
if [ -f apps/xuong-video/.next.new/BUILD_ID ] && ! cmp -s apps/xuong-video/.next.new/BUILD_ID apps/xuong-video/.next/BUILD_ID; then
  STUDIO_CHANGED=true
fi
if [ -f apps/xuong-video/.next.new/BUILD_ID ] && { [ "$STUDIO_CHANGED" = "true" ] || [ "$DEPS_CHANGED" = "true" ] || [ ! -f apps/xuong-video/.next/BUILD_ID ]; }; then
  rm -rf apps/xuong-video/.next.old
  [ -e apps/xuong-video/.next ] && mv apps/xuong-video/.next apps/xuong-video/.next.old
  mv apps/xuong-video/.next.new apps/xuong-video/.next
  rm -rf apps/xuong-video/.next.old
  systemctl restart mos2-studio; sleep 1
  systemctl is-active mos2-studio && echo "✓ mos2-studio active" || { echo "✗ mos2-studio failed"; systemctl status mos2-studio --no-pager | tail -20; exit 1; }
else
  rm -rf apps/xuong-video/.next.new
  echo "↺ Studio unchanged — keep running build"
fi

# 5e. Công ty AI (apps/cty, cổng 3850, mos2-cty.service, cty.on.tc) — app riêng như studio (anh chốt 10/10/2026: dựng để tham quan).
#     Unit + vhost cài từ repo (deploy/mos2-cty.service, deploy/nginx-cty.conf); idempotent.
if ! cmp -s deploy/mos2-cty.service /etc/systemd/system/mos2-cty.service; then
  cp deploy/mos2-cty.service /etc/systemd/system/mos2-cty.service && systemctl daemon-reload && systemctl enable mos2-cty >/dev/null 2>&1 && echo "✓ mos2-cty unit cài/cập nhật"
fi
if ! cmp -s deploy/nginx-cty.conf /etc/nginx/sites-enabled/cty.on.tc; then
  cp deploy/nginx-cty.conf /etc/nginx/sites-enabled/cty.on.tc && nginx -t >/dev/null 2>&1 && systemctl reload nginx && echo "✓ nginx cty.on.tc cài/cập nhật" || { echo "✗ nginx cty.on.tc: cấu hình lỗi"; rm -f /etc/nginx/sites-enabled/cty.on.tc; }
fi
CTY_CHANGED=false
if [ "$PREV_SHA" != "$NEW_SHA" ] && git diff "$PREV_SHA" "$NEW_SHA" --name-only | grep -qE "^(apps/cty/|packages/db/src/|package-lock\.json)"; then
  CTY_CHANGED=true
fi
if [ -f apps/cty/.next.new/BUILD_ID ] && ! cmp -s apps/cty/.next.new/BUILD_ID apps/cty/.next/BUILD_ID; then
  CTY_CHANGED=true
fi
if [ -f apps/cty/.next.new/BUILD_ID ] && { [ "$CTY_CHANGED" = "true" ] || [ "$DEPS_CHANGED" = "true" ] || [ ! -f apps/cty/.next/BUILD_ID ]; }; then
  rm -rf apps/cty/.next.old
  [ -e apps/cty/.next ] && mv apps/cty/.next apps/cty/.next.old
  mv apps/cty/.next.new apps/cty/.next
  rm -rf apps/cty/.next.old
  systemctl restart mos2-cty; sleep 1
  systemctl is-active mos2-cty && echo "✓ mos2-cty active" || { echo "✗ mos2-cty failed"; systemctl status mos2-cty --no-pager | tail -20; exit 1; }
else
  rm -rf apps/cty/.next.new
  echo "↺ Cty unchanged — keep running build"
fi

# 5f. Văn phòng pixel (pixel-agents standalone, cổng 3851, mos2-vp.service, vp.on.tc) — gói npm toàn cục, ghim bản; nhân sự bơm
#     bằng hook giả từ apps/cty/cong-ty (ExecStartPost). Vhost đứng sau auth_request của cty (/api/phien).
PA_VER=1.4.1
if [ "$(npm ls -g pixel-agents --depth=0 2>/dev/null | grep -o "pixel-agents@[0-9.]*")" != "pixel-agents@$PA_VER" ]; then
  npm i -g "pixel-agents@$PA_VER" --no-audit --no-fund >/dev/null 2>&1 && echo "✓ pixel-agents@$PA_VER cài" || echo "✗ pixel-agents cài lỗi — vp.on.tc chưa lên, cty vẫn chạy"
fi
if ! cmp -s deploy/mos2-vp.service /etc/systemd/system/mos2-vp.service; then
  cp deploy/mos2-vp.service /etc/systemd/system/mos2-vp.service && systemctl daemon-reload && systemctl enable mos2-vp >/dev/null 2>&1 && echo "✓ mos2-vp unit cài/cập nhật"
fi
if ! cmp -s deploy/nginx-vp.conf /etc/nginx/sites-enabled/vp.on.tc; then
  cp deploy/nginx-vp.conf /etc/nginx/sites-enabled/vp.on.tc && nginx -t >/dev/null 2>&1 && systemctl reload nginx && echo "✓ nginx vp.on.tc cài/cập nhật" || { echo "✗ nginx vp.on.tc: cấu hình lỗi"; rm -f /etc/nginx/sites-enabled/vp.on.tc; }
fi
if command -v pixel-agents >/dev/null 2>&1 && { [ "$CTY_CHANGED" = "true" ] || ! systemctl is-active --quiet mos2-vp; }; then
  systemctl restart mos2-vp; sleep 8
  systemctl is-active mos2-vp && echo "✓ mos2-vp active" || { echo "✗ mos2-vp failed (không chặn deploy)"; systemctl status mos2-vp --no-pager | tail -15; }
fi

# 5g. Proxy đa mô hình của công ty (worker/proxy.mjs, cổng 3862, mos2-cty-proxy.service) — bật 10/10/2026 cho Phòng thử
#     (anh bấm "Chạy một lượt" mới gọi mô hình; proxy đứng im không tốn gì). Nhật ký lượt ở /var/lib/cty.
mkdir -p /var/lib/cty/nhat-ky
if ! cmp -s deploy/mos2-cty-proxy.service /etc/systemd/system/mos2-cty-proxy.service; then
  cp deploy/mos2-cty-proxy.service /etc/systemd/system/mos2-cty-proxy.service && systemctl daemon-reload && systemctl enable mos2-cty-proxy >/dev/null 2>&1 && echo "✓ mos2-cty-proxy unit cài/cập nhật"
fi
if [ "$CTY_CHANGED" = "true" ] || ! systemctl is-active --quiet mos2-cty-proxy; then
  systemctl restart mos2-cty-proxy; sleep 1
  systemctl is-active mos2-cty-proxy && echo "✓ mos2-cty-proxy active" || { echo "✗ mos2-cty-proxy failed (không chặn deploy)"; systemctl status mos2-cty-proxy --no-pager | tail -10; }
fi

# 5h. Văn phòng pixel RIÊNG Phòng thử (vpthu.on.tc, :3863, HOME /var/lib/cty/vp-thu) — cùng gói pixel-agents, instance thứ hai.
if command -v pixel-agents >/dev/null 2>&1; then
  if ! cmp -s deploy/mos2-vp-thu.service /etc/systemd/system/mos2-vp-thu.service; then
    cp deploy/mos2-vp-thu.service /etc/systemd/system/mos2-vp-thu.service && systemctl daemon-reload && systemctl enable mos2-vp-thu >/dev/null 2>&1 && echo "✓ mos2-vp-thu unit cài/cập nhật"
  fi
  if ! cmp -s deploy/nginx-vpthu.conf /etc/nginx/sites-enabled/vpthu.on.tc; then
    cp deploy/nginx-vpthu.conf /etc/nginx/sites-enabled/vpthu.on.tc && nginx -t >/dev/null 2>&1 && systemctl reload nginx && echo "✓ nginx vpthu.on.tc cài/cập nhật" || { echo "✗ nginx vpthu.on.tc: cấu hình lỗi"; rm -f /etc/nginx/sites-enabled/vpthu.on.tc; }
  fi
  if [ "$CTY_CHANGED" = "true" ] || ! systemctl is-active --quiet mos2-vp-thu; then
    systemctl restart mos2-vp-thu; sleep 8
    systemctl is-active mos2-vp-thu && echo "✓ mos2-vp-thu active" || { echo "✗ mos2-vp-thu failed (không chặn deploy)"; systemctl status mos2-vp-thu --no-pager | tail -10; }
  fi
fi

# 6. Restart systemd unit
systemctl restart mos2-web
sleep 1
systemctl is-active mos2-web && echo "✓ mos2-web active" || (echo "✗ mos2-web failed"; systemctl status mos2-web --no-pager | tail -20; exit 1)

echo "── deploy complete ──"
