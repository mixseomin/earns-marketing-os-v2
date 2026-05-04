# Content Studio Context

Load khi làm việc với:
- `apps/web/src/app/p/[id]/studio/page.tsx`
- `apps/web/src/components/content-studio-real.tsx`
- `apps/web/src/components/content-studio.tsx` (mock/demo only)
- `apps/web/src/lib/actions/content.ts`
- `apps/web/src/lib/content-channels.ts`
- `apps/web/src/lib/actions/library.ts` (skill snippets)
- `apps/web/src/lib/ai/openai.ts`

---

## Domain: Content Studio

Content Studio = nơi tạo và quản lý **content pieces** — drafts cho từng channel (FB post, email, reel, Twitter thread, blog...). Tích hợp AI co-pilot qua OpenAI để sinh draft từ brief.

Content pieces là **upstream** của Publications: sau khi approve + publish → track bằng Publications monitor.

---

## Real vs Demo (`content-studio-real.tsx` vs `content-studio.tsx`)

| | `content-studio-real.tsx` | `content-studio.tsx` |
|---|---|---|
| Data source | Postgres DB qua `listContentPieces` | Hardcoded mock data |
| AI generate | `generateContent` server action (OpenAI) | Simulated |
| Used when | `project.isDemo !== true` | `project.isDemo === true` |
| Skills | `listSkills()` từ DB | [] |
| Tribes/Accounts | `listTribes`, `listAccounts` từ DB | [] |

Route logic (`studio/page.tsx`):
```ts
if (isDemo) return <ContentStudioPage />   // mock
else return <ContentStudioReal items={pieces} ... />  // real
```

---

## DB Table: `content_pieces`

Drizzle schema (`@mos2/db` → `contentPieces`). Key fields:

| Field | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `tenant_id` | text | |
| `project_id` | text | |
| `slug` | text | Auto-slugify từ title, unique per project |
| `title` | text | |
| `channel` | text | ID từ CHANNELS catalog |
| `tribe_slug` | text nullable | Link tới tribes |
| `persona` | text nullable | Handle/account persona |
| `subject` | text nullable | Subject line (email) hoặc hook |
| `body_md` | text | Full content markdown |
| `status` | text | `draft`, `approved`, `scheduled`, `published`, `archived` |
| `scheduled_at` | timestamptz nullable | |
| `published_at` | timestamptz nullable | |
| `publish_url` | text nullable | URL sau khi đã publish |
| `ai_notes` | jsonb | Array string — AI checklist (hook/tone/CTA) |
| `tags` | jsonb | Array string |
| `metrics` | jsonb | Record<string, string\|number> |
| `archived_at` | timestamptz nullable | Soft delete |

---

## Channels Catalog (`lib/content-channels.ts`)

**QUAN TRỌNG**: File này KHÔNG phải `'use server'`. Constants phải tách riêng để không bị Next.js wrap thành server action proxy (gây `s.filter is not a function` client-side).

```ts
CHANNELS = [
  { id: 'fb-post',        label: 'FB post',    icon: '📘', hint: '...' },
  { id: 'email',          label: 'Email',      icon: '✉️',  hint: '...' },
  { id: 'ad',             label: 'Ad',         icon: '📊', hint: '...' },
  { id: 'reel',           label: 'Reel/Short', icon: '🎬', hint: '...' },
  { id: 'twitter-thread', label: 'X thread',   icon: '🐦', hint: '...' },
  { id: 'landing',        label: 'Landing',    icon: '🖥',  hint: '...' },
  { id: 'dm',             label: 'DM',         icon: '💬', hint: '...' },
  { id: 'blog',           label: 'Blog',       icon: '📝', hint: '...' },
  { id: 'youtube-script', label: 'YT script',  icon: '📺', hint: '...' },
]

STATUSES = ['draft', 'approved', 'scheduled', 'published', 'archived']
```

---

## AI Co-pilot (`generateContent` in `lib/actions/content.ts`)

Model: `process.env.OPENAI_MODEL || 'gpt-4o-mini'` (cost-efficient default).

Input:
```ts
{
  prompt: string          // brief từ user
  channel: string         // channel ID
  tribeSlug?: string      // audience context
  persona?: string        // handle/account
  skillSnippet?: string   // body của skill snippet — dùng làm system prompt
}
```

Output JSON từ OpenAI:
```ts
{
  title: string       // ≤60 chars
  subject: string     // ≤80 chars hook/subject line
  bodyMd: string      // full markdown content
  aiNotes: string[]   // 3-5 quick checks: hook/tone/CTA
}
```

Flow trong UI (`ContentFormModal`):
1. User nhập brief vào textarea.
2. Chọn skill snippet (hoặc để trống → default voice prompt).
3. Click Generate → `handleAiGenerate` → gọi `generateContent` server action.
4. Kết quả tự điền `title`, `subject`, `bodyMd`, `aiNotes` vào form.
5. User review + edit + Save.

Default system prompt (khi không có skill):
> "Bạn là content creator cho marketing portfolio (Earns project). Output style trực tiếp, không sáo rỗng, action-driven."

---

## Skill Snippets (`lib/actions/library.ts`)

`SkillRow`:
```ts
{
  id: number; slug: string; title: string;
  body: string;       // nội dung snippet — dùng làm system prompt cho AI
  tags: string[];
  source: string | null; sourceUrl: string | null; license: string | null;
  updatedAt: string;
}
```

`listSkills()` — fetch từ `skill_snippets` table, filter `archived_at IS NULL`, sort `updated_at DESC`.

Trong UI: dropdown "No skill (default voice)" → chọn skill → `body` của skill làm `systemPrompt` override cho `generateContent`.

Playbook integration: hiện chưa có UI playbook riêng (marked `soon` trong SystemNav). Skill snippets là cách hiện tại để inject persona/style/voice vào AI.

Snippet variables (pattern `{{variable}}`): hiện chưa có interpolation tự động — user tự nhập qua form fields (tribe, persona). Snippets chứa instructions/personas/style guides, không phải templates với mustache vars.

---

## ContentFormModal (split layout)

Modal 94vw × 92vh, 2 cột:
- **LEFT (1.1fr)**: Form — AI co-pilot block (violet), fields (title/channel/status/tribe/persona/subject/bodyMd/tags), aiNotes display.
- **RIGHT (1fr)**: Preview render theo channel format.

URL state trong list view (`ContentStudioReal`):
- `ch` → channel filter
- `st` → status filter
- `q` → search query
- Dùng `useUrlParam` hook cục bộ (same pattern như `library-page.tsx`).

Grouping: pieces grouped by channel → `CHANNELS` order → grid `repeat(auto-fill, minmax(280px, 1fr))`.

---

## Server Actions (`lib/actions/content.ts`)

| Function | Mô tả |
|---|---|
| `createContentPiece(projectId, input)` | Insert + auto-slug unique per project + revalidate `/p/[id]/studio` |
| `updateContentPiece(id, projectId, patch)` | Patch fields + `updated_at` |
| `archiveContentPiece(id, projectId)` | Set `archived_at = NOW()` (soft delete) |
| `generateContent(input)` | OpenAI call → JSON output → fill form |

`ContentInput` interface (shared giữa create/update):
```ts
{
  slug?, title, channel, tribeSlug?, persona?, subject?,
  bodyMd, status?, scheduledAt?, publishedAt?, publishUrl?,
  aiNotes?, tags?, metrics?
}
```

---

## Gotchas

- Archive trong modal dùng `confirm()` dialog — ngược với pattern "no success alert" (feedback_no_success_alert). Đây là destructive confirm, không phải thông báo.
- Persona field: `autoComplete="off"`, `data-1p-ignore`, `data-lpignore="true"`, `name="persona-display"` — chặn iCloud/1Password autofill (pattern từ `feedback_no_autofill_inputs`).
- `aiEnabled()` check trước khi gọi OpenAI — trả `{ ok: false, error }` nếu chưa cấu hình `OPENAI_API_KEY`.
- `CHANNELS` và `STATUSES` KHÔNG được import từ `actions/content.ts` (server file) vì sẽ bị proxy — import từ `lib/content-channels.ts`.
