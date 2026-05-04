# Context: Human Inbox

> Load khi làm việc với: `lib/actions/inbox.ts`, `components/inbox-page.tsx`, `app/inbox/`, `app/p/[id]/inbox/`

---

## Domain

`HumanTask` = agent hand-off item. Agent chạy xong 1 step không thể tự làm → tạo task → operator nhận, thực hiện thủ công, upload proof URL.

Lifecycle: `pending` → `claimed` → `in_progress` → `completed` → `verified` | `cancelled`

---

## listInbox (server action)

```ts
// lib/actions/inbox.ts
listInbox(
  filterStatus: string = 'all',   // 'all' | 'pending' | 'claimed' | ...
  projectId?: string,              // scope by project (undefined = tenant-wide)
  opts?: {
    assignment?: 'all' | 'mine' | 'unassigned' | number;  // number = specific userId
    currentUserId?: number;
  }
): Promise<HumanTaskRow[]>
```

SQL adds:
- `AND ht.assigned_user_id = ${currentUserId}` khi `assignment === 'mine'`
- `AND ht.assigned_user_id IS NULL` khi `assignment === 'unassigned'`
- `AND ht.assigned_user_id = ${assignment}` khi assignment là số

**CRITICAL GOTCHA**: Bare `listInbox('all')` không có opts trả về TẤT CẢ tasks tenant → operator thấy task của người khác.

---

## InboxPage component

```tsx
// components/inbox-page.tsx
<InboxPage
  tasks={tasks}              // server-side filtered tasks
  teamMembers={teamMembers}  // [] for operators (không show assignee picker)
  currentUserId={eff!.id}
  currentUserRole={eff!.role}
  projectId={id}             // REQUIRED để refetch scope đúng project
/>
```

### Live refetch (5s interval) — đây là bug point thường gặp

```ts
// useEffect inside InboxPage:
const isOperator = currentUserRole === 'operator' || currentUserRole === 'viewer';
const fresh = await listInbox('all', projectId, {
  assignment: isOperator ? 'mine' : assignFilter,  // operators always 'mine'
  currentUserId: currentUserId ?? undefined,
});
```

Nếu quên truyền opts → sau 5s operator thấy ALL tasks → bug.

### Client-side filters

- `filterStatus` — `'open'` (default) / `'all'` / `'pending'` / `'claimed'` / `'completed'` / `'verified'` / `'engage'`
- `assignFilter` — từ URL `?assign=mine|unassigned|<userId>` (dùng URL state pattern)
- `'open'` = live + revising + stuck + success tasks (gồm cả success để user xem URL đã đăng)

### Task states (virtual)

```ts
taskState(t): 'live' | 'revising' | 'stuck' | 'success' | 'chained' | 'idle'
// live     = pending/claimed/in_progress
// revising = completed + feedbackType revise/more-info + no descendant
// stuck    = completed + feedbackType error hoặc null
// success  = completed + feedbackType success
// chained  = completed + has descendantTaskId (workflow chain tiếp)
// idle     = verified/cancelled
```

---

## Page patterns

### Tenant-wide inbox (`/inbox`)
```ts
// app/inbox/page.tsx
const assignment = eff!.role === 'operator' ? 'mine' : (from URL or 'all');
const tasks = await listInbox('all', undefined, { assignment, currentUserId: eff!.id });
```

### Project inbox (`/p/[id]/inbox`)
```ts
// app/p/[id]/inbox/page.tsx
const assignment = eff!.role === 'operator' ? 'mine' : (from URL or 'all');
const tasks = await listInbox('all', id, { assignment, currentUserId: eff!.id });
```

### Assignee picker visibility
```ts
// teamMembers chỉ load khi THỰC SỰ admin (không phải impersonating):
eff!.role === 'admin' ? listTeamMembers() : Promise.resolve([])
// Dùng eff.role, KHÔNG phải me.role — me.role luôn là 'admin' kể cả khi đang impersonate
```

---

## HumanTaskRow fields

```ts
interface HumanTaskRow {
  id, projectId, projectName, cardId, parentRunId
  title, instructions, prepPayload          // task content
  platformKey, accountId                   // which platform + account to use
  slaDueAt, status                         // deadline + lifecycle status
  claimedBy, claimedAt, completedAt, verifiedAt
  publishUrl, screenshotUrl, notes         // proof of completion
  feedbackType: 'success'|'revise'|'more-info'|'error'|null
  feedbackText
  workflowRunId                            // groups tasks in same workflow chain
  descendantTaskId                         // next task in chain (if exists)
  assignedUserId, assignedUserName         // assignment
}
```

---

## Mutations

```ts
claimTask(taskId)
unclaimTask(taskId)
completeTask(taskId, { publishUrl, screenshotUrl, notes, feedbackType, feedbackText })
cancelTask(taskId)
assignTaskToUser(taskId, userId | null)
verifyTask(taskId)
```

---

## DB table: `human_tasks`

Key columns: `id`, `tenant_id`, `project_id`, `card_id`, `parent_run_id`, `title`, `instructions`, `prep_payload` JSONB, `platform_key`, `account_id`, `sla_due_at`, `status`, `claimed_by`, `assigned_user_id`, `feedback_type`, `feedback_text`, `workflow_run_id`

Migration **0032**: added `assigned_user_id` + index.
</content>
</invoke>