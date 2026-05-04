# MOS v2 - Data Layer Context

## Overview

`apps/web/src/lib/data.ts` is the single unified data layer. All page components import from here — never directly from `@mos2/db`. The layer transparently serves either Postgres or mock fixtures depending on runtime environment.

---

## `dataMode()` — which source is active

```ts
export const dataMode = (): 'db' | 'mock' => (getDb() ? 'db' : 'mock');
```

Returns `'db'` when `DATABASE_URL` is set and `getDb()` initializes successfully. Returns `'mock'` otherwise. Page components can call this to show a "Demo mode" badge, but they never need to branch logic on it — `tryDb()` handles that automatically.

---

## `tryDb()` — the core resilience wrapper

```ts
async function tryDb<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T>
```

Pattern:
1. If `getDb()` returns `null` (no `DATABASE_URL`) — return `fallback` immediately, no DB call.
2. Otherwise call `fn()`.
3. If `fn()` throws (table missing, connection refused, any DB error) — log a warning to console with the label and error message, then return `fallback`.

This means the app boots on a half-set-up server without crashing. Every exported function in `data.ts` wraps its DB call with `tryDb`.

Example:
```ts
return tryDb(
  async () => { /* real DB query */ },
  MOCK_PROJECTS,       // fallback value — same shape as DB result
  'listProjects',      // label for the warning log
);
```

---

## Mock fallback — where it lives and when it's used

Mock data lives in `apps/web/src/lib/mock/`:
- `mock/projects.ts` — exports `PROJECTS` (array) and `SHARED_POOL`
- `mock/modes/` — `base.ts`, `extra.ts`, `index.ts` — exports `MODES` object and `getMode(id)`
- `mock/types.ts` — TypeScript interfaces: `Mode`, `Project`, `Squad`, `Card`, `FeedEvent`, `Alert`

Mock is used when:
- `DATABASE_URL` is not set (local dev without Docker)
- DB is set but a query throws (table not yet created, migration not applied)

Mock data is the **same shape** as DB-mapped rows — page components can't tell the difference.

---

## Key exported functions

### `listProjects(): Promise<Project[]>`

Returns all projects for the current user.

- Admin: sees all projects.
- Operator/viewer: SQL query on `members WHERE user_id = $me.id AND project_id IS NOT NULL AND active = true` — only projects they're a member of.
- Fallback: `MOCK_PROJECTS`.

### `getProject(id: string): Promise<Project | undefined>`

Single project by ID with access check.

- Non-admin: verified via `SELECT 1 FROM members WHERE user_id = $me.id AND project_id = $id AND active = true LIMIT 1`. Returns `undefined` if no row found.
- Fallback: `MOCK_PROJECTS.find(p => p.id === id)`.

### `getMode(id: string): Promise<Mode>`

Fetches a mode's shape (labels, KPI templates, column configs, chart data) from `modes` table.

- Mode payload fields (kpis, columns, revChart, revData, topList, suggestions, extraTab) live in `modes.payload` JSONB column.
- Arrays that are project-scoped (squads, cards, feed, alerts) are **not** in the `modes` table — they're filled from mock at this stage and overridden by `getProjectMode()`.
- Fallback: `getMockMode(id)`.

### `getProjectMode(projectId: string, modeId: string): Promise<Mode>`

The main function used by project pages. Builds a full `Mode` by:
1. Calling `getMode(modeId)` for the base shape.
2. Parallel-fetching project-scoped rows: `listSquadsByProject`, `listCardsByProject`, `listAlertsByProject`, `listRecentFeed`.
3. Merging them onto the base mode.
4. Blank-project heuristic: if DB returns 0 squads AND 0 cards, also wipe kpis/revData/suggestions/topList (so a new project reads truly empty, not mock-filled).
5. Applying `scopeModeForRole()` before returning.
- Fallback: `scopeModeForRole(baseMode, role)` with mock base.

### `scopeModeForRole(mode: Mode, role: string): Mode`

Strips sensitive data for non-admin users. Called at the end of `getProjectMode`.

**What gets stripped for operator/viewer (any role that is not `'admin'`):**

| Field | Stripped to |
|---|---|
| `squads` | `[]` |
| `kpis` | `[]` |
| `revData` | `[]` |
| `suggestions` | `[]` |
| `topList` | `[]` |
| `cards` | `[]` |
| `alerts` | `[]` |

Admin receives the mode object unchanged. Operators can only see their inbox tasks and assigned resources (handled separately via `listAccounts` owner filter).

---

## Drizzle ORM setup

### `packages/db/src/client.ts` — `getDb()`

```ts
export function getDb(): DB | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!globalThis.__mos2_db) {
    const sql = postgres(url, { max: 4, prepare: false });
    globalThis.__mos2_pg = sql;
    globalThis.__mos2_db = drizzle(sql, { schema, casing: 'snake_case' });
  }
  return globalThis.__mos2_db;
}
```

- Singleton stored on `globalThis` — survives Next.js dev HMR reloads without opening new connections.
- Pool size: `max: 4`. `prepare: false` (required for Postgres.js + Drizzle).
- `casing: 'snake_case'` — Drizzle maps camelCase schema fields to snake_case columns automatically.
- Returns `null` when `DATABASE_URL` is not set (triggers mock fallback everywhere).

### `packages/db/src/schema.ts` — table definitions

All tables use Drizzle's `pgTable`. Entry point for Drizzle schema inspection.

### `packages/db/src/readers.ts`

All DB query functions (`listProjects`, `getProjectById`, `listSquadsByProject`, etc.) live here. `data.ts` imports them from `@mos2/db` (the package export).

### `packages/db/src/index.ts` — package exports

```ts
export * from './schema';
export { getDb, closeDb, type DB } from './client';
export * from './readers';
export * as schema from './schema';
```

---

## CRITICAL — Migration split: Drizzle journal vs raw SQL

**Migrations 0000-0024** are tracked in the Drizzle journal at `packages/db/migrations/meta/_journal.json`. These are applied automatically by `npm run db:migrate` (which calls Drizzle's migrate function).

**Migrations 0025-0036** are raw SQL files in `packages/db/migrations/` but are **NOT in the Drizzle journal**. Drizzle does not know about them. They must be applied manually.

### How to apply a raw migration manually

```bash
ssh root@5.78.65.158 "psql -U mos2 mos2_prod < /opt/earns-marketing-os-v2/packages/db/migrations/0035_member_scoping.sql"
```

Or apply a range:
```bash
ssh root@5.78.65.158 "for f in /opt/earns-marketing-os-v2/packages/db/migrations/0025_publications.sql /opt/earns-marketing-os-v2/packages/db/migrations/0026_scheduler.sql; do psql -U mos2 mos2_prod < \$f; done"
```

All raw migrations use `IF NOT EXISTS` / `IF NOT EXISTS` guards — safe to re-run.

---

## All 36 tables grouped by domain

### Core (Drizzle schema, 0000-0024)
| Domain | Tables |
|---|---|
| Config | `modes`, `projects` |
| Kanban | `squads`, `agents`, `cards`, `alerts`, `feed_events` |
| Platforms | `platforms`, `platform_accounts` |
| Audiences | `tribes`, `habitats` |
| Knowledge | `knowledge_items`, `contacts` |
| QA/Roadmap | `use_cases`, `roadmap_items` |
| AI | `ai_suggestions` |
| Vaults | `media_assets`, `infra_resources`, `budget_entries` |
| Content | `content_pieces` |
| Automation | `agent_runs`, `human_tasks`, `playbooks` |
| Auth | `users`, `members` |
| Spend | `daily_spend_caps` |
| Library | `library_tools`, `skill_snippets` |

### Raw SQL only (0025-0036, not in Drizzle journal)
| Migration | Tables / Changes |
|---|---|
| 0025 | `publications`, `publication_activities` |
| 0026 | `cron_jobs`, `cron_runs` |
| 0027 | `worker_nodes` |
| 0028 | `proxies`, `browser_profiles` |
| 0029 | `platforms` ALTER (adds metadata columns) |
| 0030 | `tags` JSONB columns added to proxies, browser_profiles, library_tools, squads, tribes, publications, platform_accounts, knowledge_items, infra_resources, media_assets, contacts |
| 0031 | `platform_accounts` ALTER (adds persona columns) |
| 0032 | `members`, `human_tasks` ALTER (team assignment) |
| 0033 | `auth_tokens`, `auth_sessions` |
| 0034 | `users` ALTER (password hash) |
| 0035 | `platform_accounts`, `proxies`, `browser_profiles`, `tribes` ALTER (owner_user_id) + seeds admin memberships |
| 0036 | `members` ALTER (visibility_config, config_version) + `role_visibility_configs` table |

---

## `tenant_id` pattern

Every table has a `tenant_id TEXT NOT NULL DEFAULT 'self'` column. For solo use, all rows have `tenant_id = 'self'`. SaaS expansion would use per-customer tenant IDs.

**Rule**: every query against any table must filter `WHERE tenant_id = $TENANT`. Currently hardcoded as `'self'` in all reader functions. This is enforced at the DB query level in `readers.ts`, not left to callers.
