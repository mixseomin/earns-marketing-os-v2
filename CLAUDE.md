# MOS v2 — instructions for Claude

This is a **fresh start**, not a port of v1 (`~/Me/Earns/earns-marketing-os/`). Knowledge and organization will be rebuilt deliberately.

## Hard rules

1. **Do not import patterns from MOS v1 unless I explicitly ask.** That includes:
   - The cartography metaphor (Atlas, ports, realms, voyages, helm-compound, captain's log, ⚓ anything)
   - The 14+ page sprawl (helm/today/data/atlas/cargo/compass/treasury/library/orders/quartermaster/foundations/helm-ai)
   - The MCP tools registry (`mos__realm__update`, etc.)
   - The wiki/use-cases markdown structure
   - The Drizzle schema (`mos_*` tables, tribes, voyages, sailing_orders, etc.)
   - The Directus bridge sync layout
   - The "moonlit chart room" dark theme + Crimson Text typography

   v1 lives at `/Users/htuan/Me/Earns/earns-marketing-os/`. Look there if I ask "how did v1 do X" — but the answer to "how should v2 do X" starts blank.

2. **Don't recall v1 memory entries.** If a memory snippet mentions `mos.on.tc`, `mos_realms`, `mos__*` tools, the Atlas, Helm Compound, etc. — that's v1. v2 memory starts empty and gets built from this conversation onward.

3. **Don't recommend MCP / cron / agent infrastructure until I ask.** v2 starts as a blank Next.js shell. Add layers only when I describe a concrete pain that needs them.

4. **One screen first, drill-downs later.** v1 sprawled because I added a page per module. v2 should default to a single dense screen; new pages need justification.

## Live infra

- Repo: `https://github.com/mixseomin/earns-marketing-os-v2`
- Live: `https://mos2.on.tc` (Hetzner 5.78.65.158, port 3821)
- DB: Postgres `mos2_prod` (user `mos2`, separate from v1's `mos_prod`)
- Server dir: `/opt/earns-marketing-os-v2/`
- systemd unit: `mos2-web.service`
- Deploy: GHA on push to `main` → SSH → `./deploy.sh`
- Server config snapshots: `deploy/` (mos2-web.service + nginx-mos2.conf)

## Stack today

- Next.js 15 + React 19, App Router
- Tailwind 4 (`@theme` tokens, no plugin)
- TypeScript strict, no Drizzle yet, no DB connection wired
- Single page at `/` saying "v2 · initializing"

## What "knowledge + organization will be different" means

Open questions for me to answer (don't answer them yourself):

- What is the operational unit of v2? (v1's was: voyage. v2's might be different.)
- What is the daily workflow? (v1 leaned on Captain's Log + Command Center. v2 will figure this out empirically.)
- How are accounts / personas organized? (v1: crew + identity + port. v2 may flatten or split differently.)
- What's the audience model? (v1: 2-layer realm + tribe. v2 may simplify or replace.)

When I answer one of these, persist as a project memory entry — but don't fabricate answers.

## Tone

Stay terse. No metaphor flourishes (no ⚓ no 🗺 no parchment talk) until I introduce them. Plain words while we figure out what this is.
