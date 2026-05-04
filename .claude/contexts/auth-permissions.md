# Context: Auth & Permissions

> Load khi làm việc với: `lib/auth.ts`, `lib/visibility.ts`, `lib/actions/impersonate.ts`, `lib/actions/visibility.ts`, `lib/actions/assignments.ts`, middleware

---

## Auth model

- **Session**: httpOnly cookie `mos2-session` = random 32-byte hex token
- **DB source of truth**: `auth_sessions` table (`session_token`, `user_id`, `expires_at`, `revoked_at`)
- **Password**: bcryptjs 10 rounds, stored in `users.password_hash`
- **Bootstrap**: fresh install → no password set → `/login` shows bootstrap form → requires `MOS2_AGENT_TOKEN` env var

```ts
// lib/auth.ts — 4 key functions:
getCurrentUser()          // Fetch session cookie → validate DB → return AuthUser | null
                          // CHỈ dùng cho auth guard (if (!me) redirect('/login'))

getEffectiveUser()        // Admin có mos2-view-as cookie → return target user
                          // LUÔN dùng cho data fetch + render decision

requireAuth()             // Throws redirect if not logged in
requireRole(['admin'])    // Throws redirect if wrong role
needsBootstrap()          // Returns true if no admin has password set yet
```

---

## 3 roles

| Role | Access |
|------|--------|
| `admin` | Full access, can impersonate, manage team/visibility |
| `operator` | Assigned projects + owned entities (owner_user_id) only |
| `viewer` | Read-only on assigned projects |

---

## Impersonate mechanic

**Trigger**: Admin → Team page → click "👁 Xem" → `enterImpersonateAction(formData)`

**Flow**:
1. `enterImpersonate(userId, returnPath)` — sets `mos2-view-as=<userId>` cookie (httpOnly, max-age 3600)
2. Every page calls `getEffectiveUser()` → reads cookie → fetches target user from DB
3. `getImpersonateContext()` — returns `{ active, targetUserId, targetName, targetRole, config }` for banner
4. `ImpersonatePanel` renders: violet border banner + config toggles for admin
5. `exitImpersonate()` — deletes cookie, redirects to `/team`

**Critical**: `returnPath` should be `/inbox` not `/team`. Admin thấy được inbox của operator ngay.

**In every page**:
```ts
const me = await getCurrentUser();          // auth guard — real user
if (!me) redirect('/login?next=...');
const eff = await getEffectiveUser();       // data identity — may be impersonated target
const impCtx = await getImpersonateContext();

// Pass to AppShell:
currentUser={{ id: eff!.id, role: eff!.role, ... }}   // eff, KHÔNG phải me
impersonate={impCtx?.active ? { targetUserId, targetName, targetRole, config } : null}
```

---

## Visibility config

### Storage
- `members.visibility_config` JSONB — per-user overrides
- `role_visibility_configs` table — per-role defaults
- `members.config_version` INT — bumped on every save

### Interface
```ts
// lib/visibility.ts
interface VisibilityConfig {
  nav?: { inbox?: boolean; board?: boolean; resources?: boolean };
  resources?: {
    accounts?: boolean; media?: boolean; contacts?: boolean;
    infra?: boolean; budget?: boolean; knowledge?: boolean;
  };
}

ROLE_DEFAULTS.operator = {
  nav: { inbox: true, board: false, resources: false },
  resources: { accounts: false, media: false, contacts: false, infra: false, budget: false, knowledge: false }
}

mergeVisibility(role, userConfig)  // role defaults + user overrides, deep merge
```

### Real-time sync
- `VisibilityWatcher` component polls `/api/me/config-version` every 5s
- Version change → `router.refresh()` → server re-renders with new visibility
- Admin saves config → `saveVisibilityConfig(targetUserId, config, 'user' | 'role')`
  - scope `'user'` → update `members.visibility_config`, bump `config_version`
  - scope `'role'` → upsert `role_visibility_configs`, bump `config_version` for ALL members of that role

### Actions
```ts
// lib/actions/visibility.ts
getEffectiveVisibility(userId)                        // merges role defaults + user override
saveVisibilityConfig(targetUserId, config, scope)     // admin only
getMyConfigVersion()                                  // current user's config_version (poll endpoint)
```

---

## Data scoping

### Projects
```sql
-- Operator/viewer only see projects where they're a member:
SELECT p.* FROM projects p
JOIN members m ON m.project_id = p.id AND m.user_id = $eff_user_id
WHERE p.tenant_id = $tenant
```

### Entities (platform_accounts, proxies, browser_profiles, tribes)
```sql
-- Operator only sees their own:
WHERE owner_user_id = $eff_user_id
```

### Assignments
```ts
// lib/actions/assignments.ts
assignAccountsToMember(userId, accountIds[], projectId)  // sets owner_user_id + enables resources
enableResourcesForMember(userId)                         // merges nav.resources=true + resources.accounts=true
listAllProjectsForAssignment()                           // ALL projects — for admin use in assign UI
getProjectAccountsForMember(projectId, userId)           // with isAssigned flag
```

---

## UI gates (component level)

```tsx
// Derive once, apply everywhere:
const isOperator = currentUser?.role !== 'admin';

// sidebar.tsx:
{!isOperator && <SystemNav role="admin" />}        // Monitor/Library/Agents/Setup

// topbar.tsx:
{!isOperator && <div className="topbar-search">}
{!isOperator && <div className="live-pill">}

// app-shell.tsx:
{(currentUser?.role ?? 'admin') === 'admin' && <RightBar />}
{(currentUser?.role ?? 'admin') === 'admin' && <StatusBar />}

// resource vaults:
<AccountsVault isAdmin={!isOperator} />   // hides create/edit/delete buttons
```

---

## DB tables

- `users` — id, email, password_hash, tenant_id
- `members` — user_id, project_id (NULL = tenant-wide), role, display_name, specialty, visibility_config, config_version
- `auth_sessions` — session_token, user_id, expires_at, revoked_at
- `auth_tokens` — token (hex), type (login|reset|invite), user_id, expires_at, used_at
- `role_visibility_configs` — tenant_id, role, config JSONB, updated_at

Migration: **0033** (sessions+tokens), **0034** (password_hash), **0035** (owner_user_id), **0036** (visibility_config+config_version)
