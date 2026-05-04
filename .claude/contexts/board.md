# Context: Command Board

> Load khi làm việc với: `app/p/[id]/board/`, `components/board.tsx`, `components/card-modal.tsx`, `lib/actions/cards.ts`

---

## Domain

**Card** = work item trên kanban board. Mỗi card thuộc 1 squad, có trust level L1-L4, có thể assigned cho 1 agent run.

**Columns** (per mode, configured in `modes.payload.columns`):
- Thường: `backlog` → `active` → `awaiting_action` → `review` → `done`
- Operator thấy simplified view (không có full admin board)

---

## Mode scoping

`scopeModeForRole(mode, role)` trong `data.ts` — strips dữ liệu nhạy cảm cho non-admin:

```ts
// Các field bị strip khi role !== 'admin':
mode.squads        // squad list + agent configs
mode.kpis          // KPI numbers
mode.suggestions   // AI suggestions
mode.revData       // revenue data
mode.topList       // top performers
mode.cards         // ALL cards (operator thấy empty board)
mode.alerts        // system alerts
```

→ Operator vào board thấy empty (không có cards). Đây là **intended behavior** — operator không có quyền xem board cards mà không được assign.

---

## Board page pattern

```ts
// app/p/[id]/board/page.tsx
const me = await getCurrentUser();
if (!me) redirect(`/login?next=/p/${id}/board`);

const [eff, project, impCtx] = await Promise.all([
  getEffectiveUser(),
  getProject(id),
  getImpersonateContext(),
]);
const [mode, projects] = await Promise.all([
  getProjectMode(id, project.mode),  // scoped via scopeModeForRole
  listProjects(),
]);

// AppShell nhận currentUser là eff (operator identity), không phải me
// → RightBar + StatusBar bị ẩn cho operator
```

---

## CommandBoard component

```tsx
// components/board.tsx
<CommandBoard mode={mode} projectId={id} />
```

- `mode.cards` → array of cards for kanban columns
- `mode.squads` → squad list (admin only, stripped for operators)
- Cards grouped by `col` field into column buckets
- `needsCount` = cards in `awaiting_action` column → shown as badge on Board tab

---

## Card modal

```tsx
// components/card-modal.tsx
<CardModal card={card} mode={mode} onClose={...} />
```

Card fields:
```ts
interface Card {
  id, col, title, trust: 'L1'|'L2'|'L3'|'L4'
  squad?: string       // which squad is assigned
  priority?: number    // 1-5
  tags?: string[]
  description?: string
  dueAt?: string
}
```

---

## Trust levels

| Level | Behavior |
|-------|----------|
| L1 | Auto-publish (no human review) |
| L2 | Auto-publish + log for audit |
| L3 | Queue for human approval |
| L4 | Escalate to admin before any action |

---

## RightBar & StatusBar

Admin-only panels in `app-shell.tsx`:

```tsx
{(currentUser?.role ?? 'admin') === 'admin' && (
  <RightBar>
    {/* Alerts + Activity feed */}
    {mode?.alerts?.map(...)}
    {mode?.revData && <RevenueWidget />}
  </RightBar>
)}
{(currentUser?.role ?? 'admin') === 'admin' && (
  <StatusBar spend={...} tasks={...} queue={...} />
)}
```

Operator thấy empty black panel → đã fix bằng gate ở app-shell.

---

## Card mutations

```ts
// lib/actions/cards.ts
createCard(projectId, data)
updateCard(cardId, data)
moveCard(cardId, col)
deleteCard(cardId)
runCardAgent(cardId)   // triggers agent-runtime, creates agent_run
```

---

## DB tables

- `cards` — id, project_id, col, title, trust, squad, priority, tags JSONB, workflow_run_id
- `agent_runs` — id, card_id, squad_id, model, status, result, started_at, completed_at
- `modes` — id, label, sub, accent, payload JSONB (columns, squads, kpis, suggestions, etc.)
