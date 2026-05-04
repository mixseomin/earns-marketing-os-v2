# MOS v2 - Deploy Context

## Server

- **Host**: Hetzner 5.78.65.158 (`as.on.tc`)
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

Never commit this file. To edit: `ssh root@5.78.65.158 'nano /opt/earns-marketing-os-v2/.env.production'` then `systemctl restart mos2-web`.

---

## Deploy commands

### Quick deploy — sync source only, no git pull

Use when you've made local changes and want to push them fast without waiting for GitHub Actions:

```bash
# Sync source files
rsync -av apps/web/src/ root@5.78.65.158:/opt/earns-marketing-os-v2/apps/web/src/

# Build and restart on server
ssh root@5.78.65.158 'cd /opt/earns-marketing-os-v2/apps/web && npm run build && systemctl restart mos2-web'
```

### Full deploy — runs deploy.sh (same as GitHub Actions)

```bash
ssh root@5.78.65.158 '/opt/earns-marketing-os-v2/deploy.sh'
```

This is the same script triggered by GitHub Actions on push to `main`.

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

Pipeline:
1. `test` job: `npm ci` → `npm run lint` → `npm run typecheck`
2. `deploy` job (needs `test`): SSH into server via `appleboy/ssh-action`, runs `/opt/earns-marketing-os-v2/deploy.sh`

Secrets required in GitHub repo settings:
- `MOS_SERVER_HOST` = `5.78.65.158`
- `MOS_SERVER_USER` = `root`
- `MOS_SSH_KEY` = private key for server access

---

## Raw migrations — NOT handled by deploy.sh

`deploy.sh` runs `npm run db:migrate` which only applies migrations 0000-0024 (Drizzle journal). Migrations 0025-0036 are raw SQL files that must be applied manually.

See `data-layer.md` for the full list. To apply manually:

```bash
ssh root@5.78.65.158 "psql -U mos2 mos2_prod < /opt/earns-marketing-os-v2/packages/db/migrations/0036_visibility_config.sql"
```

All raw migrations are idempotent (`IF NOT EXISTS` guards) — safe to re-run.

---

## Verify after deploy

```bash
# Check systemd unit status
ssh root@5.78.65.158 'systemctl status mos2-web'

# Tail logs
ssh root@5.78.65.158 'journalctl -u mos2-web -n 50 --no-pager'

# Quick HTTP check
curl -I https://mos2.on.tc
```

---

## DB backup

Pre-deploy backups land at `/backup/mos2-pre-deploy-YYYYMMDD-HHMMSS.sql.gz` on the server.

Manual backup:
```bash
ssh root@5.78.65.158 "pg_dump -U mos2 mos2_prod | gzip > /backup/mos2-manual-$(date +%Y%m%d-%H%M%S).sql.gz"
```

Restore from backup:
```bash
ssh root@5.78.65.158 "gunzip -c /backup/mos2-pre-deploy-20260504-120000.sql.gz | psql -U mos2 mos2_prod"
```
