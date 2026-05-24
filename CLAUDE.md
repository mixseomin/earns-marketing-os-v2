# MOS v2 — Claude Context

## 🚨 CRITICAL DEPLOY RULE

**NEVER rsync code directly to `/opt/earns-marketing-os-v2/` on server.**

Always: `git add <my files only> && git commit && git push origin main`. GHA
auto-deploys. Server runs `git reset --hard` on every deploy — any uncommitted
file on server gets wiped when another session pushes.

Multi-session race: incident 2026-05-24 — GSC sparkline work disappeared when
parallel session pushed habitat changes. Recover meant re-rsync + chase down
"why did it vanish".

Full deploy rules + script in `.claude/contexts/deploy.md` — read it before
any deploy step.

---

## Module context files (auto-load)

Trước khi làm bất kỳ module nào, đọc context file tương ứng trong `.claude/contexts/`:

| Khi làm việc với | Load context |
|-----------------|-------------|
| `lib/auth.ts`, `lib/visibility.ts`, `actions/impersonate*`, `actions/visibility*`, `actions/assignments*`, middleware | `.claude/contexts/auth-permissions.md` |
| `actions/inbox.ts`, `components/inbox-page.tsx`, `app/inbox/`, `app/p/[id]/inbox/` | `.claude/contexts/inbox.md` |
| `app/p/[id]/board/`, `components/board.tsx`, `components/card-modal.tsx`, `actions/cards.ts` | `.claude/contexts/board.md` |
| `app/p/[id]/resources/`, `components/*-vault.tsx`, `components/resources-page.tsx` | `.claude/contexts/resources.md` |
| `app/team/`, `app/p/[id]/team/`, `components/team-page.tsx`, `actions/team.ts` | `.claude/contexts/team.md` |
| `app/p/[id]/squads/`, `components/squads-page.tsx`, `actions/squads.ts` | `.claude/contexts/squads.md` |
| `app/p/[id]/publications/`, `components/publications-page.tsx` | `.claude/contexts/publications.md` |
| `app/p/[id]/studio/`, `components/content-studio*.tsx` | `.claude/contexts/studio.md` |
| `components/app-shell.tsx`, `components/sidebar.tsx`, `components/topbar.tsx` | `.claude/contexts/app-shell.md` |
| `lib/data.ts`, `lib/mock/`, `packages/db/`, migrations | `.claude/contexts/data-layer.md` |
| `lib/agent-runtime.ts`, `lib/toolkits/`, `lib/ai-providers.ts`, `lib/circuit-breaker.ts` | `.claude/contexts/ai-runtime.md` |
| Deploy, systemd, nginx, rsync, `deploy.sh` | `.claude/contexts/deploy.md` |

---

## Hard rules (preserved)

1. **Do not import patterns from MOS v1** (cartography metaphor, Atlas/Voyage/Helm, `mos_*` tables, MCP tools, etc.). v1 lives at `/Users/htuan/Me/Earns/earns-marketing-os/`.
2. **Don't recall v1 memory entries** (`mos.on.tc`, `mos_realms`, `mos__*` tools = v1).
3. **One screen first, drill-downs later.** New pages need justification.

---

## Live infra

| | |
|---|---|
| Repo | `https://github.com/mixseomin/earns-marketing-os-v2` |
| Live | `https://mos2.on.tc` (Hetzner 5.78.65.158, port 3821) |
| DB | Postgres `mos2_prod` (user `mos2`) |
| Server dir | `/opt/earns-marketing-os-v2/` |
| systemd | `mos2-web.service` |
| Deploy | GHA on push → SSH → `./deploy.sh` (backup → git pull → npm ci → migrate → build → restart) |

---

## Stack

- **Next.js 15** + React 19, App Router, `force-dynamic` on all data pages
- **Drizzle ORM** + native PostgreSQL driver (`packages/db/`)
- **TypeScript strict**, Tailwind 4 (`@theme` tokens), Zod validation
- **OpenAI** (gpt-4o-mini default) + **Anthropic Claude** SDK for AI features
- **bcryptjs** for password auth, httpOnly cookies for sessions

---

## Monorepo layout

```
earns-marketing-os-v2/
├── apps/web/src/
│   ├── app/               # Next.js routes (28 page routes + 3 API)
│   │   ├── p/[id]/        # Project-scoped: board, inbox, resources, squads, flow, publications, team, settings
│   │   ├── inbox/         # Tenant-wide inbox
│   │   ├── team/          # Member management + visibility config
│   │   ├── library/       # Skill snippets
│   │   ├── platforms/     # Platform account registry
│   │   ├── scheduler/     # Campaign planner
│   │   ├── agents/        # Global agent monitoring
│   │   └── api/           # agent-tasks, me/config-version, cron
│   ├── components/        # 59 UI components
│   └── lib/
│       ├── auth.ts         # getCurrentUser, getEffectiveUser, session management
│       ├── data.ts         # Data layer: DB queries with mock fallback (tryDb wrapper)
│       ├── visibility.ts   # VisibilityConfig interface + ROLE_DEFAULTS
│       └── actions/        # 26 server action files
│           ├── impersonate.ts   # Admin "view-as" cookie mechanic
│           ├── visibility.ts    # saveVisibilityConfig, getEffectiveVisibility
│           ├── assignments.ts   # Project membership + entity ownership
│           ├── inbox.ts         # listInbox, claim/complete/cancel tasks
│           └── team.ts          # listTeamMembers, member CRUD
└── packages/db/
    ├── schema.ts           # Drizzle schema (36 tables)
    └── migrations/         # 0000-0036 SQL files (0030+ are raw SQL, NOT in journal)
```

---

## Domain vocabulary

| Term | Meaning |
|------|---------|
| **Mode** | Template defining KPIs, squads, card columns, AI suggestions per project type (e.g. 'affiliate', 'marketing') |
| **Project** | Operational unit — team + accounts + campaigns + tasks within one mode |
| **Squad** | Group of agents per project with shared mission, tools, model |
| **Card** | Work item (kanban) with assigned squad + human reviewer |
| **Task (HumanTask)** | Agent hand-off item in the inbox — human picks up, executes, uploads URL |
| **Tribe** | Audience segment (platform + demographic niche) linked to a project |
| **Playbook** | Template for content generation with `{{variable}}` interpolation |
| **Trust L1-L4** | Approval levels for content publication (L1 = auto-publish, L4 = requires review) |

---

## Permission model

3 roles: `admin` (full access) | `operator` (assigned entities only) | `viewer` (read-only assigned)

### Key functions

```ts
getCurrentUser()     // Always returns real session user (use for auth guards)
getEffectiveUser()   // Returns impersonated user when admin has mos2-view-as cookie
                     // Use for all data fetching / rendering decisions
```

### Impersonate mechanic
- Admin clicks "👁 View as" on team member → `enterImpersonate(userId)` → sets `mos2-view-as` cookie (1hr)
- Cookie makes `getEffectiveUser()` return target user instead of admin
- `ImpersonatePanel` component shows violet banner + config panel for admin
- `exitImpersonate()` clears cookie, returns to /team

### Visibility config
- `members.visibility_config` JSONB — per-user overrides
- `role_visibility_configs` table — per-role defaults
- `members.config_version` INT — bumped on save, client polls every 5s via `VisibilityWatcher`
- `mergeVisibility(role, userConfig)` — role defaults + user overrides deep-merged
- ROLE_DEFAULTS: operator/viewer see inbox only, no system nav, no resource vaults

### Data scoping
- Projects: operators see only where `members.user_id = me.id AND project_id IS NOT NULL`
- Entities (platform_accounts, proxies, browser_profiles, tribes): `owner_user_id = me.id`
- InboxPage refetch: must pass `{ assignment: 'mine', currentUserId }` for operators — bare `listInbox('all')` returns everything

---

## Key component patterns

### AppShell props
```tsx
<AppShell
  mode={mode}                    // Scoped via scopeModeForRole() — strips squads/kpis/suggestions for non-admin
  project={project}
  projects={projects}
  currentUser={{ id, displayName, email, role, specialty }}  // eff (effective user), not me
  impersonate={impCtx?.active ? { targetUserId, targetName, targetRole, config } : null}
  configVersion={visData?.configVersion}  // triggers VisibilityWatcher polling
>
```

### Page server component pattern
```ts
const me = await getCurrentUser();    // auth guard
if (!me) redirect('/login?next=...');
const eff = await getEffectiveUser(); // data identity (may differ from me when impersonating)
// all data fetches use eff!.id and eff!.role
const [mode, projects, impCtx] = await Promise.all([...]);
```

### UI guards for operator
```tsx
const isOperator = currentUser?.role !== 'admin';
{!isOperator && <RightBar />}          // admin-only panels
{!isOperator && <div className="live-pill">}  // topbar elements
{!isOperator && <SystemNav />}         // Library/Agents/Setup nav groups
```

---

## Database migrations (critical)

Migrations 0000-0024 are in Drizzle journal → `npm run db:migrate` applies them.
**Migrations 0025-0036 are raw SQL files, NOT in Drizzle journal** → must apply manually:

```bash
ssh root@5.78.65.158 'psql "$DATABASE_URL" -f /opt/earns-marketing-os-v2/packages/db/migrations/0036_visibility_config.sql'
```

Key tables by migration:
- `0030` — tags JSONB + category on proxies/profiles/squads/tribes (GIN index)
- `0031` — platform_accounts persona model (persona_kind, persona_owner_name, represents_account_id)
- `0032` — members.display_name + specialty; human_tasks.assigned_user_id
- `0033` — auth_sessions + auth_tokens tables
- `0034` — users.password_hash (bcrypt, replaces magic-link)
- `0035` — owner_user_id on platform_accounts/proxies/browser_profiles/tribes
- `0036` — members.visibility_config + config_version; role_visibility_configs table

---

## Deploy workflow

```bash
# 1. Sync source (local → server)
rsync -av apps/web/src/ root@5.78.65.158:/opt/earns-marketing-os-v2/apps/web/src/

# 2. Build + restart on server
ssh root@5.78.65.158 'cd /opt/earns-marketing-os-v2/apps/web && npm run build && systemctl restart mos2-web'

# OR full deploy (includes migrate + seed)
ssh root@5.78.65.158 '/opt/earns-marketing-os-v2/deploy.sh'
```

---

## Known gotchas

- `'use server'` files only export async functions — never export constants/arrays (get proxied → "filter is not a function")
- Client-side `listInbox('all')` refetch without opts fetches ALL tenant tasks — always pass assignment filter
- `router.replace` in Next.js client: always use absolute `${pathname}?${qs}` not relative `?qs`
- Migrations 0025-0036 not in Drizzle journal → application errors (column does not exist) if skipped
- `useLocalStorage` naive init in Next.js client: gate writes behind `hydrated` flag to avoid SSR clobber
- Directus batch `PATCH /items/<coll>` silently no-ops — loop individual PATCH per id instead
- All outbound dashboard links must route via `href.li` to strip referrer

---

## Current implementation state (2026-05-04)

### Done
- Auth: email+password, session cookie, bootstrap flow
- Roles: admin / operator / viewer with data scoping
- Impersonate: admin "view-as" cookie + ImpersonatePanel with live config
- Visibility config: per-user + per-role, real-time via config_version polling (5s)
- Inbox: project-scoped + tenant-wide, assignment filter, 5s live refresh
- Resources: 6 vaults (accounts/media/contacts/infra/budget/knowledge), operator-scoped
- Team page: member modal with "Giao Tài Nguyên" assign section
- TopBar: operator sees Board+Inbox+Resources only, no search/live-pill
- Sidebar: operator sees no SystemNav (Monitor/Library/Agents/Setup groups)

### Active / in-progress
- SquadFormModal 2-column wide layout
- Command Board + RightBar operator gating

### Pending backlog
- Demo squads: Planner / Writer / Designer / Publisher
- Worker workflow chain: card complete → auto-spawn next step
- Inbox feedback type: success / revise / error → trigger downstream
- Anchor card 'Reddit Launch Orit' full flow test
