# AppShell Context

Load khi làm việc với:
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/sidebar.tsx`
- `apps/web/src/components/topbar.tsx`
- `apps/web/src/components/rightbar.tsx`
- `apps/web/src/components/statusbar.tsx`
- `apps/web/src/components/impersonate-panel.tsx`
- `apps/web/src/components/visibility-watcher.tsx`
- `apps/web/src/components/tweaks.tsx`

---

## AppShell: Root Layout Wrapper

`AppShell` là `'use client'` component bao toàn bộ UI layout. Mọi route page render children bên trong AppShell.

### Props (đầy đủ)

```ts
{
  children: ReactNode
  mode?: Mode              // squad mode config (squads, label, accent, killBudget)
  project?: Project        // project hiện tại
  projects: Project[]      // danh sách projects cho ProjectSwitcher
  tab?: Tab                // active tab: 'dashboard'|'board'|'squads'|'tribes'|'studio'|'resources'|'settings'
  isPortfolio?: boolean    // true khi ở /library, /roadmap, /tests, /settings/api, /ai-log (portfolio-level routes)
  currentUser?: CurrentUserInfo | null
  impersonate?: {
    targetUserId: number
    targetName: string
    targetRole: string
    config: VisibilityConfig
  } | null
  configVersion?: number   // khi defined → bật VisibilityWatcher polling
}
```

### CurrentUserInfo

```ts
{
  id: number
  displayName: string
  email: string
  role: 'admin' | 'operator' | 'viewer'
  specialty?: string
}
```

---

## Render Structure

```
<>
  [ImpersonatePanel]         -- chỉ render khi impersonate prop truthy
  [VisibilityWatcher]        -- chỉ render khi configVersion !== undefined
  <ThemeApplier />           -- apply CSS accent từ mode.accent
  <div.app
    data-sidebar="shown|hidden"
    data-anim="on|off"
    style={{ paddingTop: 44 }}  -- chỉ khi impersonate active (offset banner)
  >
    <TopBar />
    [Sidebar]                -- chỉ render khi tweaks.showSidebar = true
    <main.main>
      {children}
    </main>
    [RightBar]               -- admin-only
    [StatusBar]              -- admin-only
    <TweaksPanel />          -- luôn render (hidden by default)
  </div>
</>
```

Admin-only gating pattern:
```ts
{(currentUser?.role ?? 'admin') === 'admin' && <RightBar ... />}
{(currentUser?.role ?? 'admin') === 'admin' && <StatusBar ... />}
```
Fallback `?? 'admin'` khi `currentUser` undefined (unauthenticated shell) — coi như admin.

---

## TopBar

Props: `tab, mode, currentProject, isPortfolio, projectCount, currentUser`.

Operator/viewer vs admin differences (xem `topbar.tsx`):
- Admin: thấy search, live-pill, RightBar toggle.
- Operator: không có search, không live-pill.

---

## Sidebar

### Squad section (phần trên)
- List `mode.squads` — mỗi squad card có icon (màu từ `s.color`), name, `active/agents` count, health pulse.
- Click squad → toggle expand (local state, không navigate).
- Count header: `SQUADS · {mode.label} | {squads.length} / {total agents}ag`.

### Project tabs (luôn hiện khi `currentProjectId` defined)
Links admin-only: **Tribes**, **Publications** (📡 cyan), **Flow** (🗺 violet).
Links cho mọi role: **Resources** (🗂).

### SystemNav (bottom, chỉ admin)
3 groups hover → float popout sang phải:

| Group | Items |
|---|---|
| Monitor | Department (admin), Agents Admin (admin), Inbox, Scheduler (admin), AI Activity (admin), Tests (admin), Roadmap |
| Library | Tools & Skills, Playbooks (soon) |
| Setup | Team (admin), API Keys (admin), Platforms, Environments (admin), Trust thresholds (soon), All Projects |

Filter rule: items với `role: 'admin'` bị ẩn nếu `role !== 'admin'`. Operator thấy: Inbox, Roadmap, Tools & Skills, Platforms, All Projects.

Popout behavior: hover row → float menu `position: fixed` tính từ `getBoundingClientRect()`. Chỉ 1 group open tại 1 thời điểm. Close delay 600ms (bridge hover gap).

### UserPanel (bottom)
Avatar (initial letter), displayName, `role · specialty`, logout button (↪).
Avatar color: violet=admin, cyan=operator, fg-3=viewer.

### Kill Switch
Admin-only button ⚠ "Pause all agents" — màu kill budget cap/used từ `mode.killBudget`.

---

## ImpersonatePanel

Renders khi `impersonate` prop truthy. Banner 44px height → `<div.app style={{ paddingTop: 44 }}>` để không che content.

---

## VisibilityWatcher

Renders khi `configVersion` prop defined. Poll `/api/me/config-version` mỗi **5 giây** — detect khi admin thay đổi visibility config của operator đang login → trigger page refresh.

Pattern: chỉ pass `configVersion` prop trong routes operator có thể xem.

---

## TweaksPanel (Dev panel)

Tweaks state (`useTweaks` hook, persisted localStorage):

| Key | Type | Default | Effect |
|---|---|---|---|
| `lang` | `'vi'|'en'` | `'vi'` | Language via `LangContext` |
| `theme` | `'dark'|'light'` | `'dark'` | CSS class trên `<html>` |
| `accent` | `'auto'|'cyan'|'lime'|'amber'|'violet'|'pink'` | `'auto'` | CSS `--accent` override |
| `showSidebar` | boolean | `true` | Toggle Sidebar render |
| `columnCount` | 3-5 | 4 | Kanban columns count |
| `animation` | boolean | `true` | `data-anim` attr on `.app` |
| `livePolling` | boolean | `true` | alerts/feed 30s polling |

---

## CSS Variables (Dark Theme)

```css
--bg-0: #0a0a0a        /* deepest background */
--bg-1: #111           /* panel bg */
--bg-2: #1a1a1a        /* input / card bg */
--fg-0: #f0f0f0        /* primary text */
--fg-1: #c0c0c0        /* secondary text */
--fg-2: #888           /* tertiary */
--fg-3: #555           /* muted */
--fg-4: #333           /* very muted */
--accent: var(--neon-cyan)  /* primary accent (mode-aware) */
--accent-soft: rgba(0,229,255,.08)
--line: rgba(255,255,255,.07)    /* border subtle */
--line-strong: rgba(255,255,255,.14)
--bad: #ff4d5e          /* error/danger */
--ok: #39d353           /* success/active */
--neon-cyan:   #00e5ff
--neon-lime:   #b2ff59
--neon-amber:  #ffb300
--neon-violet: #9d6cff
--neon-pink:   #ff4081
--font-mono: 'JetBrains Mono', monospace
```

## Cookie: `mos2_last_project_id`

AppShell set cookie khi `project?.id` defined và `!isPortfolio`. Max-age 30 ngày. Portfolio routes (`/library`, `/roadmap`, `/tests`, `/settings/api`) đọc cookie này để giữ context project trong Sidebar/ProjectSwitcher — tránh fallback về project đầu tiên khi user navigate từ `/p/orit/` sang `/library`.

---

## `data-screen-label` Pattern

`<main data-screen-label={screenLabel}>` — dùng cho analytics/testing. Format:
- Portfolio: `"portfolio"`
- Project: `"{project.id}-{tab ?? 'dashboard'}"`
- Bare shell: `"shell"`

---

## Gotchas

- `RightBar` và `StatusBar` fallback `?? 'admin'` khi `currentUser` undefined → chúng luôn render trong unauthenticated context. Nếu cần gating strict, phải pass `currentUser` explicit.
- `tweaks.showSidebar = false` → Sidebar unmount hoàn toàn (không hidden), mất hover/popout state.
- Impersonate `paddingTop: 44` là inline style trực tiếp trên `.app` div — không phải CSS class. Đừng dùng CSS để reset.
- `ThemeApplier` nhận `modeAccent` từ `mode.accent` — mỗi project mode có accent màu riêng (override `--accent` CSS var).
