# Publications Context

Load khi làm việc với:
- `apps/web/src/app/p/[id]/publications/page.tsx`
- `apps/web/src/components/publications-page.tsx`
- `apps/web/src/lib/actions/publications.ts`
- `apps/web/src/lib/publications/types.ts`
- `apps/web/src/lib/publications/fetchers/`

---

## Domain: What is a Publication?

Publication = một bài post đã publish lên forum/Reddit/HN/LinkedIn mà hệ thống **theo dõi reply và engagement theo thời gian**. Không phải nội dung được tạo trong Studio — đó là `content_pieces`. Publications track **outbound content đã live**.

Workflow: publish bài lên Reddit → paste URL vào MOS → system poll định kỳ → khi có reply mới → tạo inbox task cho human engage.

---

## DB Table: `publications`

Key columns (raw SQL, không Drizzle schema):

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `tenant_id` | text | DEFAULT `'self'` |
| `project_id` | text | FK to projects |
| `url` | text | URL gốc của post |
| `title` | text nullable | Auto-fetch khi check lần đầu |
| `platform_key` | text | `reddit`, `hackernews`, `xenforo`, `linkedin`, `generic_forum` |
| `account_id` | integer nullable | FK to accounts (persona đã post) |
| `published_at` | timestamptz | Khi bài được publish |
| `last_checked_at` | timestamptz | Lần check gần nhất |
| `last_activity_at` | timestamptz | Lần có reply/activity gần nhất |
| `check_interval_hours` | integer | Default từ platform config |
| `next_check_at` | timestamptz | Khi nào poll tiếp theo |
| `reply_count` | integer | |
| `view_count` | integer nullable | |
| `score` | integer nullable | Upvotes/karma |
| `status` | text | `active`, `paused`, `archived` |
| `metadata` | jsonb | Platform-specific extras |

Table `publication_activities`: từng reply/comment được detect.

| Column | Notes |
|---|---|
| `publication_id` | FK |
| `detected_at` | |
| `activity_type` | e.g. `reply`, `comment` |
| `external_id` | ID trên platform |
| `author` | Username |
| `content_snippet` | Preview text |
| `activity_url` | Direct link tới reply |
| `human_task_id` | Nullable — nếu tạo inbox task |

---

## Publications Page (`/p/[id]/publications`)

- Admin-only: route redirect về `/p/[id]/inbox` nếu không phải admin.
- Component: `PublicationsPage` từ `publications-page.tsx`.
- Auto-refresh: client poll mỗi **30 giây** qua `listPublications` server action (không dùng `router.refresh()` để giữ form state).
- Filter chips: `all | active | paused | archived` — filter phía client, không URL state (khác với Studio dùng `useUrlParam`).
- StatsStrip: Total / Active / With Replies / Checked Today.

### PublicationRow (expandable table row)
- Click row → expand → load `publication_activities` lazy (server action).
- Interval control: chọn `1h / 2h / 6h / 12h / 24h` trong expanded view.
- Golden window: Reddit = 6h, HackerNews = 24h, else 48h. Hiển thị countdown nếu chưa expire.
- Evergreen platforms (xenforo, generic_forum) không show golden window.
- Archive: double-confirm pattern (click `🗄` → đổi thành `Confirm?` → click lần 2).
- Outbound links phải wrap qua `href.li` — pattern: `` `https://href.li/?${url}` ``.

### AddPublicationForm
- Paste URL → `onBlur` gọi `detectPlatform()` client-side (200ms debounce).
- Auto-detect platform + hiện pill với `defaultIntervalHours`.
- Title optional (auto-fetch on first check).
- `published_at` optional datetime-local input.

---

## Platform Configs (`PLATFORM_CONFIGS`)

```ts
// lib/publications/types.ts
{
  xenforo:       { label: 'XenForo Forum', icon: '🏛️', defaultIntervalHours: 6,  evergreen: true },
  reddit:        { label: 'Reddit',        icon: '🟠', defaultIntervalHours: 1,  evergreen: false },
  hackernews:    { label: 'Hacker News',   icon: '🔶', defaultIntervalHours: 2,  evergreen: false },
  linkedin:      { label: 'LinkedIn',      icon: '💼', defaultIntervalHours: 24, evergreen: false },
  generic_forum: { label: 'Forum',         icon: '📋', defaultIntervalHours: 12, evergreen: true },
}
```

`detectPlatform(url)` — regex match, fallback `generic_forum`.

---

## Fetchers (`lib/publications/fetchers/`)

`fetchPlatform(platform, url, lastActivityAt)` — dispatcher:
- `reddit` → `fetchReddit` (Reddit JSON API)
- `hackernews` → `fetchHackerNews` (Algolia HN API)
- `xenforo`, `generic_forum`, default → `fetchRss` (RSS/Atom feed parse)
- LinkedIn: không có fetcher riêng (platform blocks scraping), dùng RSS fallback.

Fetchers return `FetchResult`:
```ts
{
  title?, replyCount?, viewCount?, score?, lastActivityAt?,
  newActivities: Array<{ externalId, author, contentSnippet, activityUrl, publishedAt }>
}
```

Monitor cron (`lib/publications/monitor.ts`) gọi fetcher + upsert DB + tạo inbox tasks.

---

## Server Actions (`lib/actions/publications.ts`)

| Function | Mô tả |
|---|---|
| `listPublications(projectId)` | Fetch tất cả publications của project, sort `last_activity_at DESC NULLS LAST, created_at DESC`, limit 200 |
| `addPublication(data)` | Insert + `ON CONFLICT DO NOTHING` + `revalidatePath` |
| `updatePublicationStatus(id, status)` | Patch status, revalidate `/p` |
| `updatePublicationInterval(id, hours)` | Patch interval + reset `next_check_at = NOW()` |
| `getPublicationActivities(publicationId, limit=30)` | Fetch activities cho 1 publication, sort `detected_at DESC` |

Gotcha: `'use server'` file — chỉ export async functions. Constants/types phải nằm trong `lib/publications/types.ts` riêng.

---

## Relationship với Content Pieces

- `content_pieces` (Studio) = nội dung được tạo, chưa publish.
- `publications` = bài đã publish, đang được monitor.
- Hiện chưa có FK trực tiếp giữa hai table — link thủ công qua `publish_url` trong content_pieces.
- Squads/Tribes: publications chưa join trực tiếp với squads/tribes; context đến qua `project_id`.
