# Context: Team Management

> Load khi làm việc với: `app/team/`, `app/p/[id]/team/`, `components/team-page.tsx`, `components/project-team-page.tsx`, `lib/actions/team.ts`, `lib/actions/assignments.ts`

---

## Domain

**Member** = user trong MOS2 tenant. Có 2 loại member record:
1. **Tenant-wide** (`project_id IS NULL`) — role/display_name/specialty của user trong tenant
2. **Project-scoped** (`project_id = <id>`) — role + membership trong specific project

---

## Member model

```ts
interface TeamMemberRow {
  userId: number
  email: string
  name: string
  displayName: string           // preferred display (set by admin)
  role: 'admin'|'operator'|'viewer'
  specialty: 'writer'|'community'|'designer'|'video'|'outreach'|'analytics'|'ops'
  bio?: string
  active: boolean
  projectIds?: string[]         // projects they're member of
  visibilityConfig?: VisibilityConfig
  configVersion?: number
}
```

---

## Team page (`/team`)

- Lists all tenant members
- Admin can: edit role/specialty/displayName, assign projects, assign resources, impersonate
- Operator cannot access (redirect to /inbox)

### MemberFormModal sections

1. **Thông tin cơ bản** — displayName, role, specialty, bio, active toggle
2. **Phân công project** — `AssignmentInventory` component
   - Lists all projects with toggle (isMember on/off)
   - `setProjectMembership(userId, projectId, isMember, role)`
3. **Giao Tài Nguyên** — `AssignResourcesSection` component (cyan border)
   - Loads ALL projects via `listAllProjectsForAssignment()` (independent of member's current access)
   - Shows accounts per project with checkbox to assign
   - `assignAccountsToMember(userId, accountIds, projectId)` → sets owner_user_id + enables resources
4. **Cấu hình hiển thị** — visibility config panel
   - Nav toggles: inbox / board / resources
   - Resources toggles: accounts / media / contacts / infra / budget / knowledge
   - Scope: user này | cả role [role]

### Impersonate button in modal

```tsx
<form action={enterImpersonateAction}>
  <input type="hidden" name="userId" value={member.userId} />
  <input type="hidden" name="returnPath" value="/inbox" />
  <button type="submit">👁 Xem như {member.displayName}</button>
</form>
```

---

## Project team (`/p/[id]/team`)

- Project-scoped member list
- Same actions but scoped to project
- Admin only

---

## Key server actions

```ts
// lib/actions/team.ts
listTeamMembers()                                        // all tenant members
updateMember(userId, { displayName, role, specialty, bio, active })

// lib/actions/assignments.ts
listMemberProjects(userId)                               // all projects + isMember flag
setProjectMembership(userId, projectId, isMember, role) // add/remove from project
listAllProjectsForAssignment()                           // ALL projects for admin assign UI (not scoped to member access)
getProjectAccountsForMember(projectId, userId)           // accounts + isAssigned flag
assignAccountsToMember(userId, accountIds[], projectId)  // sets owner_user_id + enables resources
enableResourcesForMember(userId)                         // visibility_config.nav.resources=true + .resources.accounts=true
listMemberEntities(userId)                               // aggregate all owned entities
```

---

## AssignResourcesSection gotcha

**Problem (fixed)**: Component used to receive `projectIds` from `AssignmentInventory.onProjectIds` callback. When member had no project access → `projectIds = []` → showed "Chưa có project nào".

**Fix**: Component now calls `listAllProjectsForAssignment()` directly on mount — independent of member's current project membership. Admin sees ALL projects regardless.

---

## DB tables

- `users` — id, email, password_hash, name, tenant_id
- `members` — user_id, project_id (NULL = tenant-wide), tenant_id, role, display_name, specialty, bio, active, visibility_config JSONB, config_version
- Unique constraint: `(tenant_id, user_id, project_id)` (project_id nullable)

Migration **0032**: added display_name, specialty, bio, active to members.
Migration **0036**: added visibility_config, config_version to members.
