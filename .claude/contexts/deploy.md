# MOS v2 - Deploy Context

## ⚠️ DEPLOY RULE — never rsync directly

**ALWAYS deploy via `git push origin main` → GHA auto-deploys.**

Reason: server runs `git reset --hard origin/main` on every GHA fire. Any file
on server `/opt/earns-marketing-os-v2/` that ISN'T in the GitHub commit will be
**silently wiped** next time another session pushes. Multiple Claude sessions
push concurrently — happened 2026-05-24 with GSC sparkline work being erased.

```bash
# ❌ NEVER do this:
rsync ... root@167.233.241.16:/opt/earns-marketing-os-v2/...
ssh ... 'npm run build && systemctl restart mos2-web'

# ✅ ALWAYS do this:
git add <specific files only — not other sessions' work>
git commit -m "..."
git push origin main   # GHA pulls, builds, restarts
```

**Server-only files** (cron scripts in `/usr/local/bin/`, `/etc/*.json`,
`/opt/cgg-report/`): document trong skill files at `~/.claude/skills/<topic>/`
+ commit nội dung script file vào repo `scripts/` nếu cần version control.

**Before starting any new work**: `git status` to see what's uncommitted from
prior sessions. If untracked/modified files exist that aren't yours, leave them
alone — only commit YOUR changes by explicit `git add <files>` (never `git add .`).

---

## Server

- **Host**: box3 `167.233.241.16` (Hetzner Nuremberg, 7 GB) — từ 05/08/2026. **box1 `5.78.65.158` (as.on.tc) KHÔNG còn chạy MOS2**: chỉ còn bản cũ ở `/opt/earns-marketing-os-v2` (không có `scripts/gop-y.sh`, `mos2-web` inactive) + đường hầm `box3-tunnel` (`:3821`, `:5434` → box3). Lệnh nhắm box1 sẽ báo lỗi hoặc đọc dữ liệu cũ, trông như MOS2 chết.
- **DB**: Postgres native trên box3 (không docker), `mos2_prod`; luôn đi `psql "$DATABASE_URL"` sau khi nạp `.env.production`
- **App port**: 3821
- **App dir**: `/opt/earns-marketing-os-v2`
- **Systemd unit**: `mos2-web`
- **Public URL**: https://mos2.on.tc

---

## Systemd unit — `mos2-web.service`

File: `/etc/systemd/system/mos2-web.service` (source: `deploy/mos2-web.service`)

```ini
[Service]
Type=simple
User=root
WorkingDirectory=/opt/earns-marketing-os-v2/apps/web
EnvironmentFile=/opt/earns-marketing-os-v2/.env.production
Environment=NODE_ENV=production
Environment=PORT=3821
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=3
```

Reads all secrets from `.env.production`. Port is set via `PORT=3821` env var.

---

## Nginx — `mos2.on.tc`

File: `/etc/nginx/sites-available/mos2.conf` (source: `deploy/nginx-mos2.conf`)

- HTTP (80) redirects to HTTPS.
- HTTPS (443): SSL via Let's Encrypt at `/etc/letsencrypt/live/mos2.on.tc/`.
- Proxies to `http://127.0.0.1:3821`.
- `proxy_read_timeout 60s` — important for slow AI-backed routes.
- WebSocket support: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"`.

---

## Environment file

Path on server: `/opt/earns-marketing-os-v2/.env.production`

Loaded by systemd `EnvironmentFile=` directive. Contains at minimum:
- `DATABASE_URL` — Postgres connection string for `mos2_prod`
- Any `OPENAI_API_KEY`, `MOS2_TENANT`, etc.

Never commit this file. To edit: `ssh root@167.233.241.16 'nano /opt/earns-marketing-os-v2/.env.production'` then `systemctl restart mos2-web`.

---

## Deploy commands

Chỉ một đường: `git push origin main` → GHA → `~/bin/gh-watch deploy.yml`. Không có "quick deploy" bằng rsync (bị `git reset --hard` xoá ở lượt sau, xem đầu file).

GHA sập (chỉ khi đó) → chạy chính script mà GHA chạy, trên box3:

```bash
ssh root@167.233.241.16 '/opt/earns-marketing-os-v2/deploy.sh'
```

---

## `deploy.sh` — step by step

File: `/opt/earns-marketing-os-v2/deploy.sh`

| Step | What it does |
|---|---|
| 1. Pre-deploy DB backup | `pg_dump -U mos2 mos2_prod \| gzip > /backup/mos2-pre-deploy-TIMESTAMP.sql.gz`. Best-effort: skips if DB not ready yet. |
| 2. Git pull | `git fetch origin main && git reset --hard origin/main`. Records `PREV_SHA` and `NEW_SHA`. |
| 3. `npm ci` | Only runs if `package.json` or lockfile changed between SHAs. Uses `--prefer-offline --no-audit --no-fund`. |
| 4. `db:migrate` | `npm run db:migrate` — applies Drizzle journal migrations (0000-0024). Always runs (idempotent). |
| 4b. `db:seed` | `npm run db:seed` — idempotent spec seed (modes, platforms, use_cases). If `MOS2_AUTO_SEED=1` is set, also wipes and re-seeds demo projects (destructive). |
| 5. `build:web` | `npm run build:web` — only runs if `apps/web/` source changed, deps changed, or `.next` is missing. |
| 6. Restart | `systemctl restart mos2-web`, then checks `systemctl is-active mos2-web`. Exits non-zero if not active. |

---

## CRITICAL — `MOS2_AUTO_SEED=1` warning

```bash
# DO NOT run this carelessly — it wipes all demo project data
MOS2_AUTO_SEED=1 ./deploy.sh
```

The default `db:seed` (without `MOS2_AUTO_SEED=1`) is safe and idempotent — it only upserts modes, platforms, and use cases. It does **not** touch user-managed state (use case status/feedback, project data, accounts).

Setting `MOS2_AUTO_SEED=1` triggers a destructive re-seed of demo projects. Never set it in `.env.production` permanently.

---

## GitHub Actions

File: `.github/workflows/deploy.yml`

Triggers on:
- Push to `main` branch (excluding `*.md`, `wiki/**`, `decisions/**`, `.gitignore` changes)
- Manual `workflow_dispatch`

Pipeline (chạy trên `ubuntu-latest`, KHÔNG phải runner tự host): build ở GHA → `scp` gói `.next` sang máy chủ → `ssh` chạy `SKIP_BUILD=1 deploy.sh`.

Secrets: `DEPLOY_HOST` (= box3 `167.233.241.16`), `DEPLOY_SSH_KEY`. Runner tự host `actions.runner.…mos2-as-on-tc` trên box1 là đồ sót lại, workflow không dùng.

---

## Raw migrations — deploy.sh tự chạy

`deploy.sh` có bộ chạy migration theo tệp: mọi `packages/db/migrations/NNNN_*.sql` chưa có trong bảng `_file_migrations` được áp khi deploy. Thêm migration = thêm tệp + push, không áp tay. Kiểm đã áp chưa:

```bash
ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -tAc "SELECT * FROM _file_migrations ORDER BY 1 DESC LIMIT 5"'
```

---

## Verify after deploy

```bash
# Check systemd unit status
ssh root@167.233.241.16 'systemctl status mos2-web'

# Tail logs
ssh root@167.233.241.16 'journalctl -u mos2-web -n 50 --no-pager'

# Quick HTTP check
curl -I https://mos2.on.tc
```

---

## DB backup

Pre-deploy backups land at `/backup/mos2-pre-deploy-YYYYMMDD-HHMMSS.sql.gz` on the server.

Manual backup:
```bash
ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; pg_dump "$DATABASE_URL" | gzip > /backup/mos2-manual-$(date +%Y%m%d-%H%M%S).sql.gz'
```

Restore from backup:
```bash
ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; gunzip -c /backup/mos2-pre-deploy-<TIMESTAMP>.sql.gz | psql "$DATABASE_URL"'
```
