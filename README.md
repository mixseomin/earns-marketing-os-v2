# Earns Marketing OS — v2

A fresh start. Knowledge + organization will be rebuilt from scratch — not a port of v1.

- Live: https://mos2.on.tc
- Server: Hetzner 5.78.65.158 (`/opt/earns-marketing-os-v2/`)
- DB: Postgres `mos2_prod` (separate from v1)
- Port: 3812 (v1 = 3811)

## Status

Initializing. No domain knowledge, no schema, no UI yet — just a deployable shell.

## Local dev

```bash
npm install
npm run dev   # http://localhost:3000
```

## Deploy

Push to `main`. GitHub Actions runs `deploy.sh` on the server via SSH.

## Layout

```
apps/web         Next.js 15 (React 19) frontend
packages/        (added when needed)
deploy.sh        server-side pull + build + restart
.github/         GHA workflow
```
