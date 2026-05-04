# MOS2 — Squads Context

**Load khi làm việc với:**
- `apps/web/src/app/p/[id]/squads/page.tsx`
- `apps/web/src/components/squads-page.tsx`
- `apps/web/src/components/squad-drawer.tsx`
- `apps/web/src/lib/actions/squads.ts`
- `apps/web/src/lib/actions/agents-admin.ts`
- `packages/db/src/schema.ts` (squads, agents, agent_runs tables)

---

## Squad Domain Model

A **squad** is a named group of agents scoped to a project. It defines the AI persona, tools, trust boundary, and model used for cards routed to it. Squads are the primary unit of automation configuration.

**Key relationships:**
- `squads` 1:N `agents` (individual AI workers; agentRef like 'RES-04')
- `cards.squadKey` → `squads.squadKey` — denormalized text key (not FK) for query speed
- `agent_runs.squad_id` → `squads.id` — FK, set null on squad delete
- Deleting a squad orphans existing cards (squadKey still preserved in card row — by design)

---

## DB Table: squads

```
squads (
  id            bigserial PK
  tenantId      text default 'self'
  projectId     text → projects.id (cascade)
  squadKey      text         -- slug: 'research', 'content', 'publisher'
  name          text         -- display name
  vi            text         -- Vietnamese label
  icon          text         -- single emoji
  agents        smallint     -- total agent count (display only)
  active        smallint     -- active agent count (display only)
  color         text         -- hex color for UI card
  descText      text
  health        text         -- 'ok' | 'warn' | 'bad'
  config        jsonb        -- SquadConfig (see below)
  tags          jsonb        -- JSONB array, GIN indexed (migration 0030)
  createdAt / updatedAt
)
UNIQUE (projectId, squadKey)
```

**SquadConfig (config JSONB shape):**
```ts
{
  mission?: string          // 1-line squad goal
  skillsMd?: string         // Markdown persona/expertise bullets for system prompt
  tools?: string[]          // IDs from library_tools.id
  systemPrompt?: string     // Full LLM system prompt (overrides skillsMd in runtime)
  model?: string            // e.g. 'gpt-4o-mini', 'claude-haiku-4-5'
  trustLevel?: 1 | 2 | 3 | 4
  useAgentLoop?: boolean    // Phase 10: enable full LLM tool-use loop. Default false.
}
```

**Tags pattern (migration 0030):** `tags JSONB NOT NULL DEFAULT '[]'` + `squads_tags_gin` GIN index. Filter via `tags @>` operator. Tags added via `<TagsInput>` component. Note: tags on squads are not yet surfaced in SquadFormModal (as of writing) - future work.

---

## DB Tables: agents + agent_runs

**agents** - individual AI workers within a squad:
```
agents (id, tenantId, projectId, squadId → squads.id set null, agentRef 'RES-04',
        label, status active|throttled|down|retired, trustLevel, metadata jsonb)
UNIQUE (projectId, agentRef)
```

**agent_runs** - audit log of every AI execution:
```
agent_runs (
  id, tenantId, projectId, cardId, agentKind, agentRef, squadId,
  playbookSlug, playbookStepId, parentRunId,
  status: pending|running|completed|failed|timed_out|rejected
  startedAt, completedAt, durationMs, timeoutAt,
  input jsonb, output jsonb, artifacts jsonb, toolsUsed jsonb,
  tokensIn, tokensOut, costUsdCents,
  error, peerReview jsonb, idempotencyKey, attempt, confidence
)
```
Indexed on: tenant, project, card, agentKind, status, createdAt, idempotencyKey.

---

## Cards → Squads Relationship

`cards.squadKey` (text, denorm) links a card to which squad handles it. Additionally:

- `cards.agentKind` — which model/kind: `'gpt-4o-mini'`, `'claude-haiku-4-5'`, `'human'`, `'claude-code'`, `null`
- `cards.dispatch_ready` (boolean) — gate before worker picks up card
- `cards.idempotency_key` — prevents double-exec across retries
- `cards.level` (1-4) — trust level copied from squad or overridden per-card

Worker selects cards where `dispatch_ready = true AND agentKind NOT IN ('claude-code', 'human') AND squad.useAgentLoop = true`.

---

## Trust Levels

| Level | Name | Behavior |
|-------|------|----------|
| L1 | AUTO | Execute silently — no report |
| L2 | NOTIFY | Execute + push log for async review |
| L3 | APPROVE | Queue card on Command Board, await human approval |
| L4 | ESCALATE | Halt related actions + alert Telegram/Slack/on-screen |

Trust level inherited from squad (`config.trustLevel`), overridable per-card (`cards.level`). Worker enforces trust gates before runAgent.

---

## Key Server Actions

**`lib/actions/squads.ts`** (`'use server'`):
- `createSquad(projectId, SquadInput)` — auto-generates squadKey from name, deduplicates
- `updateSquad(projectId, squadKey, patch)` — partial update, revalidates board + squads pages
- `deleteSquad(projectId, squadKey)` — hard delete, orphans cards (by design)
- Revalidates: `/p/${projectId}/squads`, `/p/${projectId}`, `/p/${projectId}/board`

**`lib/actions/agents-admin.ts`** (`'use server'`, admin only):
- `listAgentKindStats()` — 24h aggregate stats per agentKind
- `listRecentAgentRuns(limit)` — last N runs across all projects
- `listCardAgentRuns(projectId, cardRef)` — runs for a specific card, enriched with knowledge + media entries
- `listReasoningSquads()` — squads with useAgentLoop or any AI config set
- `toggleSquadReasoning(projectId, squadKey, enable)` — toggle 1 squad
- `setSoloReasoningSquad(projectId, squadKey)` — pause all, activate only this one (pilot mode)
- `resetAgentBreaker(agentKind)` — manual circuit breaker reset
- `listEligibleCards()` — preview which cards worker will pick next cycle
- `triggerWorkerNow(maxCards)` — on-demand worker cycle from UI button
- `deleteAgentRun(runId, alsoDeleteKnowledge)` — delete run + optionally cascade to knowledge_items
- `getSystemFlags()` — env var health check (API keys, kill switch, cron secret)

---

## SquadFormModal (current state)

**File:** `apps/web/src/components/squads-page.tsx` - `SquadFormModal` component.

**Status: being refactored to 2-column wide 1100px layout (in progress).** Current modal is already `maxWidth: 1200` with 2-column grid (`gridTemplateColumns: '1fr 1fr'`), but the layout refactor is ongoing.

Key form sections:
1. Identity: icon (emoji picker), name, vi (Vietnamese), health, agents count, active count, description, color
2. AI Config section (below divider):
   - Mission (1-line goal)
   - Skills (markdown textarea + "Pick from library" → `SkillPickerModal`)
   - Tools (grouped by TOOL_CATEGORIES, filterable, toggle chip, "Only integrated" checkbox)
   - Model (dropdown from `availableModels` loaded from `getAvailableModels()`)
   - Trust level (L1-L4 select)
   - System prompt (textarea)
   - Agent loop toggle (`useAgentLoop`) - warns when tools selected but loop OFF

**AIFormParser** is embedded at top of modal body — user can paste natural language squad description and have fields auto-filled.

**SkillPickerModal:** 2-pane (list 300px + preview). Picks from `skill_snippets` table. Can append or replace `skillsMd`. Skills filtered by title/tags/body.

**ToolInfoModal:** small detail card showing tool status, category, requiresEnv, sourceUrl. Toggle add/remove from squad.

---

## Page Route: /p/[id]/squads

**File:** `apps/web/src/app/p/[id]/squads/page.tsx`

- **adminOnly:** `me.role !== 'admin'` redirects to `/p/${id}/inbox`. Operators never see this page.
- Loads: `getProject`, `getProjectMode`, `listProjects`, `listTools()`, `listSkills()`, `getAvailableModels()`
- Passes `mode` (contains `mode.squads[]` and `mode.squadsTitle`) to `SquadsPage`
- URL param `?edit=<squadKey>` auto-opens edit modal (deep-link from board/other pages)

---

## Squad Cards Grid (SquadsPage)

Squads rendered as 2-column card grid. Each card shows:
- Donut chart: active/agents utilization
- Mission (italic quote)
- Skills preview (first non-heading markdown line, mono)
- Tool icons (up to 6, with tooltip; overflow "+N" indicator)
- Stats row: Active, Tasks/h (estimated: active × 4.2), Utilization %, Trust L#, Model
- Health chip: ok (green) / warn (yellow) / bad (red)
