# MOS2 — AI Runtime Context

**Load khi làm việc với:**
- `apps/web/src/lib/agent-runtime.ts`
- `apps/web/src/lib/worker.ts`
- `apps/web/src/lib/circuit-breaker.ts`
- `apps/web/src/lib/toolkits/` (index, registry, research, creative, publisher, analytics)
- `apps/web/src/lib/workflows.ts`
- `apps/web/src/lib/ai-providers.ts`
- `apps/web/src/lib/actions/agents-admin.ts`
- `apps/web/src/app/api/cron/worker/route.ts`
- `apps/web/src/app/agents/page.tsx`

---

## agent-runtime.ts — Core Loop

**Phase 10** — LLM tool-use loop. `import 'server-only'`.

**Flow:** `runAgent(opts)` → branch by model prefix → `runClaudeLoop` or `runOpenAILoop`

```
trigger card
  → worker creates agent_run row (status=running)
  → build systemPrompt = squad.config.systemPrompt + squad.config.skillsMd
  → build userPrompt = card.title + card.body (or workflow step bodyTemplate)
  → call runAgent()
    loop up to maxIter=15:
      LLM call (Anthropic or OpenAI)
      if tool_use blocks → invokeTool() → append result → next iteration
      if no tool calls → return final text
  → update agent_run (output, cost, tools_used, status=completed|failed)
  → optional: spawn peer review run
  → advance card column (board state)
```

**Model routing:**
- `claude-*` → Anthropic SDK (`runClaudeLoop`)
- `gpt-* / o3-*` → OpenAI SDK (`runOpenAILoop`)
- `claude-code` → throws `unsupported_kind` (MCP user pull, not exec here)
- `human` → throws `unsupported_kind` (queues `human_tasks`)

---

## AI Providers

**File:** `apps/web/src/lib/ai-providers.ts`

Available providers (controlled by env vars):

| Provider | Env var | Models |
|----------|---------|--------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o-mini (default), gpt-4o, gpt-4.1-mini, gpt-4.1, o3-mini |
| Anthropic | `ANTHROPIC_API_KEY` | claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-7 |
| Google | `GOOGLE_API_KEY` | gemini-2.5-flash, gemini-2.5-pro |
| xAI | `XAI_API_KEY` | grok-2, grok-2-mini |

`getAvailableModels()` returns only models whose provider env var is set. Squad model dropdown shows only available models + warns if none configured.

**Default model:** `gpt-4o-mini` (cheapest, fastest; used in `emptySquad()` default config).

**Cost rates** (cents per 1M tokens, in/out):
```
gpt-4o-mini:      15 /  60
gpt-4o:          250 / 1000
claude-haiku-4-5:  80 /  400
claude-sonnet-4-6: 300 / 1500
claude-opus-4-7: 1500 / 7500
```
Stored as integer cents in `agent_runs.cost_usd_cents` (avoids float precision issues).

---

## Toolkit Categories

**File:** `apps/web/src/lib/toolkits/`

Barrel import via `index.ts` (import side-effect populates registry before any invokeTool call). Worker + cron routes MUST import `'./toolkits'` to register tools.

| File | Tools |
|------|-------|
| `research.ts` | `web-search` (Brave API + DDG fallback), `web-scrape`, `embed` (OpenAI text-embedding-3-small), `save-knowledge` (insert knowledge_items) |
| `creative.ts` | `image-gen`, `image-gen-dalle`, copywriting/creative tools |
| `publisher.ts` | platform posting, scheduling tools |
| `analytics.ts` | metrics fetch, report tools |

**Tool registration pattern:**
```ts
register({
  id: 'web-search',
  schema: z.object({ query: z.string(), limit: z.number().default(10) }),
  output: z.object({ results: z.array(...) }),
  sideEffect: 'read',           // 'read' | 'write' | 'destroy'
  timeoutMs: 15_000,
  costEstimateCents: 0,
  fn: async (input, ctx) => { ... },
});
```

**Tool ID convention:** hyphen-separated slug in registry (`web-search`). Anthropic API requires underscore — auto-converted: `def.id.replace(/-/g, '_')` before sending to LLM, converted back after response.

---

## Tool Registry

**File:** `apps/web/src/lib/toolkits/registry.ts` — `import 'server-only'`

```ts
// Key functions:
register(def: ToolDef)          // populate in-memory Map
getTool(id: string)             // lookup by id
invokeTool(toolId, rawInput, ctx) // validate input → enforce trust gate → timeout → validate output
listRegisteredTools()           // for debug/admin
```

**invokeTool flow:**
1. Lookup registry — `unknown_tool` if missing
2. Trust gate: `ctx.trustDecision === 'deny'` → reject; `'queue_human'` → reject
3. Zod input validation
4. Timeout race (default 30s, override via `def.timeoutMs`)
5. Execute `def.fn(input, ctx)`
6. Zod output validation
7. Return `{ ok: true, output }` or `{ ok: false, error, reason }`

**ToolContext:**
```ts
{
  projectId: string
  agentRunId?: number       // agent_runs.id (audit)
  cardId?: number
  idempotencyKey?: string
  trustDecision?: 'allow' | 'queue_human' | 'deny'   // set by caller before invokeTool
}
```

---

## Circuit Breaker

**File:** `apps/web/src/lib/circuit-breaker.ts` — `import 'server-only'`

Per `agentKind` in-memory circuit breaker. Guards against runaway AI burn.

**Thresholds:**
- Failure window: 10 minutes
- Failure threshold: 5 consecutive failures within window
- Pause duration: 1 hour

**Logic:** `checkBreaker(agentKind)`:
1. Fast path: in-memory `breakerStates` Map — if paused return `{ allowed: false, pausedUntil }`
2. Slow path: DB query `agent_runs WHERE status IN ('failed','timed_out') AND created_at > NOW() - 10min`
3. If `recentFailures >= 5` → set in-memory pause for 1h → `{ allowed: false }`

**Storage:** In-memory Map (single Next.js process). Multi-instance needs Redis/DB. Fine for solo/single-node deploy (mos2.on.tc).

**Reset:** `resetBreaker(agentKind)` — deletes Map entry. Exposed via `resetAgentBreaker()` server action + admin UI.

**`listPausedKinds()`** — returns all currently paused agentKinds with `pausedUntil` timestamp, used by `listAgentKindStats()` to annotate stats table.

---

## Anti-Loop Guards (agent-runtime.ts)

Prevent stuck/runaway agent loops:

| Guard | Threshold | reason code |
|-------|-----------|-------------|
| Max iterations | 15 | `max_iter` |
| Cost cap | 1000 cents ($0.10) | `cost_cap` |
| Repetitive action | same tool+input 5× | `repetitive` |
| Stuck detector | total duration > 5min | `timeout` |

`REPETITIVE_THRESHOLD = 5` (bumped from 3 — cheap models retry 3-4x before pivoting, threshold 3 caused false positives).

---

## Workflow System / Playbook Resolver

**File:** `apps/web/src/lib/workflows.ts` — NOT 'use server', safe to import from both server + client.

Multi-step content workflows (DAG chains). Each step → 1 squad + body template. Worker auto-spawns next step card after successful run.

**Current workflows:**
- `medium-publish`: plan → write (1500-2500w) → design hero → human handoff publish
- `reddit-launch`: plan → write post → design image → human post
- (more in file)

**WorkflowStep fields:**
```ts
{
  stepKey: string           // 'plan' | 'write' | 'design' | 'publish'
  squadKey: string          // which squad handles this step
  agentKind: string         // model to use
  bodyTemplate: string      // prompt template with {{key}} vars
  trustLevel: 1 | 2 | 3 | 4
  isFinal?: boolean         // last step, don't spawn next
}
```

**Template variables** (filled from `cards.workflow_context` JSONB):
- `{{brief}}` — original brief from anchor card
- `{{plan}}` — output of plan step
- `{{post}}` — output of write step
- `{{imageUrl}}` — media URL from design step
- `{{imageAssetId}}` — media_assets.id
- `{{imageConcept}}` — image concept text

**`renderBodyTemplate(template, context)`** — replaces `{{key}}` with `context[key]`, falls back to `'(empty)'`.

Cards track workflow state via:
- `cards.workflow_key` — which workflow ('reddit-launch')
- `cards.workflow_step` — current step key ('plan')
- `cards.workflow_run_id` — UUID linking all steps of a run
- `cards.workflow_context` — JSONB accumulated outputs (grows each step)

---

## Trust Gates (worker.ts integration)

Trust gate applied by worker before dispatching to `runAgent`:

- **L1 AUTO:** `ctx.trustDecision = 'allow'` → full exec
- **L2 NOTIFY:** `ctx.trustDecision = 'allow'` + push log entry → exec, user sees results async
- **L3 APPROVE:** Worker creates `human_tasks` row + moves card to queue column → `ctx.trustDecision = 'queue_human'` → invokeTool returns reject
- **L4 ESCALATE:** Stop all related actions + alert (Telegram/Slack placeholder, on-screen) → `ctx.trustDecision = 'deny'`

Trust level sourced from `squad.config.trustLevel`, overridable at card level via `cards.level`.

---

## Error Handling in agent_runs

`agent_runs.status` lifecycle:
```
pending → running → completed
                 → failed        (llm_error, tool_error, exec_error)
                 → timed_out     (timeout guard or timeoutAt exceeded)
                 → rejected      (trust gate deny, circuit breaker blocked)
```

`agent_runs.error` text — reason string from `AgentRunResult.reason`:
- `completed` — success
- `max_iter` — loop limit hit
- `cost_cap` — budget exceeded
- `repetitive` — same tool+input N times
- `stuck` — no progress
- `timeout` — duration cap
- `tool_error` — tool invocation failed
- `llm_error` — provider API error
- `unsupported_kind` — claude-code or human

`agent_runs.toolsUsed` JSONB array: `[{ toolId, input, output, durationMs, ok, error? }]`

`agent_runs.peerReview` JSONB: `{ model, decision, reasoning, cost_cents }` — populated after peer review run (`parentRunId` links back to original).

---

## Skill Snippets (library)

**DB table:** `skill_snippets` — reusable markdown persona/expertise snippets.

```
skill_snippets (
  id, tenantId, slug, title, body (markdown), tags jsonb,
  source, sourceUrl, license
)
UNIQUE (tenantId, slug)
```

Used in `SquadFormModal` via **SkillPickerModal**: search by title/tags/body, preview in 2-pane UI, "Append" or "Replace" into `squad.config.skillsMd`.

`squad.config.skillsMd` is passed as the skills section of the system prompt in `runAgent`. The runtime concatenates: `systemPrompt = squad.config.systemPrompt` (explicit prompt takes priority; if empty, skillsMd is used to build persona context).

---

## System Flags / ENV

Critical env vars for agent runtime:
- `OPENAI_API_KEY` — OpenAI models
- `ANTHROPIC_API_KEY` — Claude models
- `BRAVE_SEARCH_API_KEY` — web-search tool (falls back to DDG if unset)
- `MOS2_KILL_SWITCH=1` — global emergency stop (worker skips all cards)
- `MOS2_CRON_SECRET` — auth header for `/api/cron/worker` POST
- `MOS2_AGENT_TOKEN` — agent API token
- `DEFAULT_TENANT_ID` — defaults to `'self'` (solo tenant)
- `WORKER_NODE_ID` / `WORKER_NODE_LABEL` — for worker_nodes heartbeat table

`getSystemFlags()` in agents-admin.ts returns boolean status of all above — shown in /agents admin panel.

---

## Worker Daemon

**Cron trigger:** `POST /api/cron/worker` with `x-cron-secret` header. Typically every 5 minutes via systemd timer on mos2.on.tc.

**On-demand:** `triggerWorkerNow(maxCards)` server action — used by "Run now" button in /agents page.

**Idempotency:** Atomic `UPDATE cards SET processing_since = NOW() WHERE ... FOR UPDATE SKIP LOCKED` claim pattern prevents double-processing in concurrent workers.

Cards stuck in processing (claim > 15 min, e.g., worker crash) become re-claimable.

**Admin page:** `/agents` (adminOnly) — shows:
- System flags panel
- Eligible cards preview
- Reasoning squads list + toggle
- Agent kind stats (24h)
- Recent runs log
- Circuit breaker state + reset buttons
