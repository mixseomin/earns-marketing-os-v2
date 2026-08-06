'use server';

// Per-project backlink task surface (/p/[id]/backlinks). A backlink source is a
// shared cross-project entity (human_tasks platform_key='backlink', view `backlinks`);
// a project "owns" a task when its site slug is a key in site_status. We scope by that
// membership — same data as the cross-project Architect grid, filtered to one site.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { resolveSiteSlug, BACKLINK_SITES } from '@/lib/backlink-sites';
import { detectPlatformKeyFromUrl, canonPlatformKey } from '@/lib/habitat-platform-map';
import { getBacklinkAccountType, readinessBucket, pickBestAccount, recommendedAccountRole, type BacklinkAccountType, type ReadinessBucket, type AccountRole } from '@/lib/backlink-account-type';
import { resolveSeedGates, type SeedGate } from '@/lib/link-gate-resolve';

export interface BacklinkVerify { reachable: boolean; found: boolean; dofollow: boolean; mentioned?: boolean; httpStatus: number | null; checkedAt: string }

export interface BacklinkTask {
  id: number;
  title: string;
  status: string;                 // row-level human_tasks.status
  siteState: string;              // this site's status (site_status[slug])
  siteLiveUrl: string | null;     // this site's placed URL (site_url[slug])
  siteDoneAt: string | null;      // when this site reached completed/verified
  siteScheduledAt: string | null; // planned date (YYYY-MM-DD) to do this site
  siteSubmittedAt: string | null; // when this site entered "submitted" (awaiting moderation)
  siteVerify: BacklinkVerify | null; // last link health-check result for this site
  sourceUrl: string | null;
  da: string | null;
  dofollow: string | null;
  traffic: string | null;
  rank: string | null;
  mechanism: string | null;
  tier: string | null;             // A = high-value focus · B = editorial outreach · C = self-serve directory · null
  draft: string | null;
  draftShort: string | null;      // AI-condensed short version (persisted)
  draftImages: string[];          // optional images embedded in the draft (all formats)
  hasDraft: boolean;
  instructions: string | null;
  notes: string | null;
  workerNote: string | null;                       // staff free-text: result report + opinions
  blocker: { reason: string; at: string; paused?: boolean; origin?: number; shot?: string; needsHuman?: boolean; note?: string } | null;  // active blocker; paused = auto-held (sibling blocked); shot = screenshot URL; needsHuman = drives the RED on-screen alert (assisted/manual/blocked)
  resolved: { at: string; note?: string } | null;  // "vừa gỡ vướng" marker; cleared when staff opens the task
  draftReview: { status: 'pending' | 'changes' | 'approved'; at?: string; thread: Array<{ by: string; kind: string; action: string; note?: string; at: string }> } | null;  // AI draft chờ nhân sự duyệt (🔴) + luồng tương tác (approve / request-changes)
  draftPlan: { week?: string; goal?: string; items: Array<{ thread_url: string; thread_title: string; thread_tag?: string | null; comment: string; why?: string }>; voice_note?: string; ops_note?: string; ops_warn?: string } | null;  // structured seeding draft (N comment cards, EN content) — supersedes the markdown `draft` wall for community-seed weeks
  grounded: { at: string; host?: string; source?: string; sampleId?: number; sampleAt?: string } | null;  // instructions rewritten against real captured DOM
  fillFields: { at: string; items: Array<{ key: string; label: string; type: string; value: string; source: string; confidence: string }> } | null;  // ✨ Chuẩn bị điền: prepared per-field values for the source's real form
  domSampleId: number | null;   // latest dom_samples row for this task's source host (for the drawer "🔎 DOM" check link)
  // Catalog provenance: the shared backlink_sources row this task's source_url comes from (null = ad-hoc, not in catalog).
  catalogSourceId: number | null;
  catalogSourceName: string | null;
  catalogSourceStatus: string | null;
  catalogVia: 'source' | 'method' | null;  // 'method' = bung ra từ 1 catalog METHOD (fanout_from), không phải source trực tiếp
  // Linked outreach prospect (this task was sent into the Outreach pipeline). null = not linked yet.
  outreach: { prospectId: number; status: string; channel: 'email' | 'form'; campaignId: number | null } | null;
  siteStatus: Record<string, string>;
  siteUrl: Record<string, string>;
  appliesTo: string[];
  publishUrl: string | null;
  screenshotUrl: string | null;
  assignedUserId: number | null;
  assignee: string | null;
  createdAt: string | null;
  // account readiness (derived from source_url → platform → platform_accounts)
  platformKey: string | null;
  platformLabel: string | null;
  accountType: BacklinkAccountType;
  recommendedRole: AccountRole;   // which P/B/S account type fits this source (from platform category)
  communitySeed: boolean;         // 🌱 community-seed (platform has link_gate_enabled → build standing before a link) vs 🔗 one-shot acquire
  seedGate: SeedGate | null;      // 🌱 only: per-community link readiness (resolved account×subreddit brief). null = not community-seed / unresolved.
  readiness: ReadinessBucket;
  accountId: number | null;
  accountHandle: string | null;
  accountStatus: string | null;
  has2fa: boolean;
  authMethod: string | null;
  hasProxy: boolean;
  hasProfile: boolean;
  // Set ONLY in the global /plays aggregate (getAllBacklinkTasks). undefined on a per-project fetch.
  projectId?: string;       // the task's real MOS2 project id (for the drawer's project-scoped actions)
  projectSlug?: string;     // the site_status key (for setBacklinkSite) — differs from id only via override
  projectLabel?: string;    // display label
  projectEmoji?: string;
}

const asObj = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

// List the backlink/distribution tasks that apply to a project. Registered SEO sites use their slug;
// ANY other project falls back to its id (the site_status key the seeder / fan-out writes) so marketing
// projects (astrolas, …) can hold plays too. Empty result if the project simply has no tasks.
// Platform catalog for URL→key detection (signup_url host + bare-hostname keys).
// Built once; the global /plays view reuses it across all 11 sites instead of
// re-running the 300-row `SELECT … FROM platforms` (~36ms) per site.
type PlatformCatalog = { catSlug: Map<string, string>; allKeys: Set<string> };
async function buildPlatformCatalog(db: NonNullable<ReturnType<typeof getDb>>): Promise<PlatformCatalog> {
  const catSlug = new Map<string, string>();
  const allKeys = new Set<string>();
  try {
    const cat = await db.execute(sql`SELECT key, signup_url FROM platforms`);
    for (const row of (cat as unknown as Array<{ key: string; signup_url: string | null }>)) {
      allKeys.add(row.key);
      if (!row.signup_url) continue;
      try { const h = new URL(row.signup_url).hostname.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); if (h && !catSlug.has(h)) catSlug.set(h, row.key); } catch { /* skip bad url */ }
    }
  } catch { /* catalog unavailable → regex-only fallback */ }
  return { catSlug, allKeys };
}

export async function getBacklinkTasks(projectId: string, catalog?: PlatformCatalog): Promise<BacklinkTask[]> {
  const slug = resolveSiteSlug(projectId) ?? projectId;
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.execute(sql`
      SELECT id, title, status, source_url, da, dofollow, traffic, rank, mechanism, tier,
             draft, draft_short, draft_images, has_draft, instructions, notes, site_status, site_url, applies_to,
             publish_url, screenshot_url, assigned_user_id, assignee,
             (site_status->>${slug}) AS site_state,
             (site_url->>${slug})    AS site_live_url,
             (site_done_at->>${slug})      AS site_done_at,
             (site_scheduled_at->>${slug}) AS site_scheduled_at,
             (site_submitted_at->>${slug}) AS site_submitted_at,
             (site_verify->${slug})        AS site_verify,
             worker_note, blocker, resolved, grounded, fill_fields, draft_review, draft_plan,
             created_at
      FROM backlinks
      WHERE jsonb_exists(site_status, ${slug})
      ORDER BY created_at DESC NULLS LAST, id DESC`);
    // Nhận diện platform curated qua CATALOG (signup_url host) — không chỉ HOSTNAME_TO_PLATFORM regex.
    // Platform mới thêm vào catalog (chưa có regex) vẫn được nhận → account KHỚP (cùng key reconcile bên
    // ext). Site LẠ (không regex + không catalog) → null → no-account default (KHÔNG false-block).
    // Global /plays passes a prebuilt catalog so it's fetched once, not per-site.
    const { catSlug, allKeys } = catalog ?? await buildPlatformCatalog(db);
    const keyForUrl = (url: string | null): string | null => {
      if (!url) return null;
      const byRegex = canonPlatformKey(detectPlatformKeyFromUrl(url) || '');
      if (byRegex) return byRegex;
      try {
        const h = new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        // signup_url match first (curated), else the platform whose KEY is the hostname itself
        // (wiki/KG/resource platforms seeded with empty signup_url, e.g. wikidata-org).
        return catSlug.get(h) ?? (allKeys.has(h) ? h : null);
      } catch { return null; }
    };
    const base = (rows as unknown as Array<Record<string, unknown>>).map((r) => {
      const sourceUrl = (r.source_url as string | null) || null;
      const platformKey = keyForUrl(sourceUrl);
      return {
        id: Number(r.id),
        title: String(r.title ?? ''),
        status: String(r.status ?? 'pending'),
        siteState: String(r.site_state ?? 'pending'),
        siteLiveUrl: (r.site_live_url as string | null) || null,
        siteDoneAt: (r.site_done_at as string | null) || null,
        siteScheduledAt: (r.site_scheduled_at as string | null) || null,
        siteSubmittedAt: (r.site_submitted_at as string | null) || null,
        siteVerify: (r.site_verify as BacklinkVerify | null) || null,
        sourceUrl,
        da: (r.da as string | null) || null,
        dofollow: (r.dofollow as string | null) || null,
        traffic: (r.traffic as string | null) || null,
        rank: (r.rank as string | null) || null,
        mechanism: (r.mechanism as string | null) || null,
        tier: (r.tier as string | null) || null,
        draft: (r.draft as string | null) || null,
        draftShort: (r.draft_short as string | null) || null,
        draftImages: Array.isArray(r.draft_images) ? (r.draft_images as string[]) : [],
        hasDraft: r.has_draft === 'ready',
        instructions: (r.instructions as string | null) || null,
        notes: (r.notes as string | null) || null,
        workerNote: (r.worker_note as string | null) || null,
        blocker: (r.blocker && typeof r.blocker === 'object' && !Array.isArray(r.blocker))
          ? (r.blocker as { reason: string; at: string; paused?: boolean; origin?: number; shot?: string; needsHuman?: boolean; note?: string }) : null,
        resolved: (r.resolved && typeof r.resolved === 'object' && !Array.isArray(r.resolved))
          ? (r.resolved as { at: string; note?: string }) : null,
        draftReview: (r.draft_review && typeof r.draft_review === 'object' && !Array.isArray(r.draft_review))
          ? (r.draft_review as { status: 'pending' | 'changes' | 'approved'; at?: string; thread: Array<{ by: string; kind: string; action: string; note?: string; at: string }> }) : null,
        draftPlan: (r.draft_plan && typeof r.draft_plan === 'object' && !Array.isArray(r.draft_plan) && Array.isArray((r.draft_plan as { items?: unknown }).items))
          ? (r.draft_plan as { week?: string; goal?: string; items: Array<{ thread_url: string; thread_title: string; thread_tag?: string | null; comment: string; why?: string }>; voice_note?: string; ops_note?: string; ops_warn?: string }) : null,
        grounded: (r.grounded && typeof r.grounded === 'object' && !Array.isArray(r.grounded))
          ? (r.grounded as { at: string; host?: string; source?: string; sampleId?: number; sampleAt?: string }) : null,
        fillFields: (r.fill_fields && typeof r.fill_fields === 'object' && !Array.isArray(r.fill_fields) && Array.isArray((r.fill_fields as Record<string, unknown>).items))
          ? (r.fill_fields as { at: string; items: Array<{ key: string; label: string; type: string; value: string; source: string; confidence: string }> }) : null,
        domSampleId: null as number | null,   // resolved batched below (view subquery per-row = O(task×dom) chậm)
        siteStatus: asObj(r.site_status),
        siteUrl: asObj(r.site_url),
        appliesTo: asArr(r.applies_to),
        publishUrl: (r.publish_url as string | null) || null,
        screenshotUrl: (r.screenshot_url as string | null) || null,
        assignedUserId: r.assigned_user_id != null ? Number(r.assigned_user_id) : null,
        assignee: (r.assignee as string | null) || null,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at as string | null) || null,
        platformKey,
        accountType: getBacklinkAccountType(platformKey),
      };
    });

    // dom_sample_id BATCHED (thay subquery tương quan per-row của view — O(task×dom_samples), ~110ms/49 dòng).
    // 1 query: latest dom_sample cho mỗi hostname xuất hiện. hostOf ≙ regexp của view (strip scheme+www).
    const hostOf = (u: string | null): string => { if (!u) return ''; try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
    const domByHost = new Map<string, number>();
    const hosts = [...new Set(base.map((t) => hostOf(t.sourceUrl)).filter(Boolean))];
    if (hosts.length) {
      const hostList = sql.join(hosts.map((h) => sql`${h}`), sql`, `);
      const ds = await db.execute(sql`SELECT DISTINCT ON (hostname) hostname, id FROM dom_samples WHERE hostname IN (${hostList}) ORDER BY hostname, captured_at DESC`);
      for (const r of ds as unknown as Array<{ hostname: string; id: number }>) domByHost.set(String(r.hostname), Number(r.id));
    }

    // Catalog provenance BATCHED: which shared backlink_sources row each task's source_url comes from.
    const srcByUrl = new Map<string, { id: number; name: string; status: string }>();
    const srcUrls = [...new Set(base.map((t) => t.sourceUrl).filter(Boolean) as string[])];
    if (srcUrls.length) {
      const urlList = sql.join(srcUrls.map((u) => sql`${u}`), sql`, `);
      const cs = await db.execute(sql`SELECT id, name, canonical_url, source_status FROM backlink_sources WHERE canonical_url IN (${urlList})`);
      for (const r of cs as unknown as Array<{ id: number; name: string; canonical_url: string; source_status: string }>) srcByUrl.set(String(r.canonical_url), { id: Number(r.id), name: String(r.name), status: String(r.source_status) });
    }

    // Fan-out provenance: sibling tasks bung ra từ 1 catalog METHOD mang prep_payload.fanout_from = id method,
    // nhưng source_url của chúng là target THẬT (không nằm trong backlink_sources) → url-match trượt. Resolve
    // fanout_from để chúng đọc là catalog-derived (📚 method) thay vì báo nhầm "ngoài catalog". BATCHED 2 query.
    const fanoutByTask = new Map<number, number>();
    const taskIds = base.map((t) => t.id);
    if (taskIds.length) {
      const idList = sql.join(taskIds.map((i) => sql`${i}`), sql`, `);
      const ff = await db.execute(sql`SELECT id, (prep_payload->>'fanout_from')::int AS ff FROM human_tasks WHERE id IN (${idList}) AND prep_payload ? 'fanout_from'`);
      for (const r of ff as unknown as Array<{ id: number; ff: number | null }>) if (r.ff != null) fanoutByTask.set(Number(r.id), Number(r.ff));
    }
    const srcById = new Map<number, { id: number; name: string; status: string }>();
    const fanoutSrcIds = [...new Set(fanoutByTask.values())];
    if (fanoutSrcIds.length) {
      const idList = sql.join(fanoutSrcIds.map((i) => sql`${i}`), sql`, `);
      const cs = await db.execute(sql`SELECT id, name, source_status FROM backlink_sources WHERE id IN (${idList})`);
      for (const r of cs as unknown as Array<{ id: number; name: string; source_status: string }>) srcById.set(Number(r.id), { id: Number(r.id), name: String(r.name), status: String(r.source_status) });
    }

    // Linked outreach prospects BATCHED: which tasks are already in the Outreach pipeline (by task_id).
    const outreachByTask = new Map<number, { prospectId: number; status: string; channel: 'email' | 'form'; campaignId: number | null }>();
    if (base.length) {
      const taskIdList = sql.join(base.map((t) => sql`${t.id}`), sql`, `);
      const pr = await db.execute(sql`SELECT id, task_id, status, campaign_id, (email IS NOT NULL AND email <> '') AS has_email FROM outreach_prospects WHERE task_id IN (${taskIdList})`);
      for (const r of pr as unknown as Array<{ id: number; task_id: number; status: string; campaign_id: number | null; has_email: boolean }>) {
        outreachByTask.set(Number(r.task_id), { prospectId: Number(r.id), status: String(r.status), channel: r.has_email ? 'email' : 'form', campaignId: r.campaign_id != null ? Number(r.campaign_id) : null });
      }
    }

    // Explicit per-task account override (human_tasks.account_id). When set, it wins over
    // the platform auto-match — the auto-match may pick a shared account that belongs to
    // another project (e.g. @oritapp for Product Hunt) which is wrong for this site.
    const overrideByTask = new Map<number, number>();
    const ids = base.map((t) => t.id);
    if (ids.length) {
      const idList = sql.join(ids.map((i) => sql`${i}`), sql`, `);
      const ov = await db.execute(sql`SELECT id, account_id FROM human_tasks WHERE platform_key = 'backlink' AND account_id IS NOT NULL AND id IN (${idList})`);
      for (const r of ov as unknown as Array<{ id: number; account_id: number }>) overrideByTask.set(Number(r.id), Number(r.account_id));
    }

    // Batched account + label lookup (no N+1): only platforms that can have an account.
    type Acct = { id: number; handle: string | null; status: string; has2fa: boolean; authMethod: string | null; hasProxy: boolean; hasProfile: boolean };
    const asAcct = (a: Record<string, unknown>): Acct => ({ id: Number(a.id), handle: (a.handle as string | null) || null, status: String(a.status), has2fa: a.has_2fa === true, authMethod: (a.auth_method as string | null) || null, hasProxy: a.has_proxy === true, hasProfile: a.has_profile === true });
    const lookupKeys = [...new Set(base.filter((t) => t.accountType !== 'no-account' && t.platformKey).map((t) => t.platformKey as string))];
    const labelMap = new Map<string, string>();
    const catMap = new Map<string, string>();   // platform_key → catalog category (drives P/B/S role)
    const gateMap = new Map<string, boolean>(); // platform_key → link_gate_enabled (community-seed class = gate on)
    const acctMap = new Map<string, Acct>();
    const acctById = new Map<number, Acct>();
    if (lookupKeys.length) {
      const inList = sql.join(lookupKeys.map((k) => sql`${k}`), sql`, `);
      const [plats, accts] = await Promise.all([
        db.execute(sql`SELECT key, label, category, link_gate_enabled FROM platforms WHERE key IN (${inList})`),
        // SECRET-SAFE: never select password_enc / api_token_enc / bot_token_enc.
        db.execute(sql`SELECT platform_key, project_id, id, handle, status, has_2fa, auth_method,
                       (proxy_id IS NOT NULL) AS has_proxy, (browser_profile_id IS NOT NULL) AS has_profile
                       FROM platform_accounts WHERE tenant_id = 'self' AND platform_key IN (${inList})`),
      ]);
      for (const p of plats as unknown as Array<{ key: string; label: string; category: string | null; link_gate_enabled: boolean }>) { labelMap.set(p.key, p.label); if (p.category) catMap.set(p.key, p.category); gateMap.set(p.key, p.link_gate_enabled === true); }
      const byKey = new Map<string, Array<Record<string, unknown>>>();
      for (const a of accts as unknown as Array<Record<string, unknown>>) {
        acctById.set(Number(a.id), asAcct(a));
        const k = String(a.platform_key);
        (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(a);
      }
      for (const [k, list] of byKey) {
        // Auto-pick must NEVER borrow another project's account (the militarymarkdown-on-astrolas bug):
        // prefer THIS project's own account, else a shared (project_id null) seeding account, else none.
        const own = list.filter((a) => String(a.project_id ?? '') === projectId);
        const pool = own.length ? own : list.filter((a) => !a.project_id);
        const best = pool.length ? (pickBestAccount(pool as Array<{ status: string }>) as Record<string, unknown> | null) : null;
        if (best) acctMap.set(k, asAcct(best));
      }
    }

    const tasks = base.map((t): BacklinkTask => {
      const overrideId = overrideByTask.get(t.id);
      const acct = (overrideId != null && acctById.get(overrideId)) || (t.platformKey ? acctMap.get(t.platformKey) ?? null : null);
      // Catalog provenance: source_url khớp catalog trực tiếp thắng; nếu không, fallback method gốc (fanout_from).
      const urlSrc = t.sourceUrl ? srcByUrl.get(t.sourceUrl) ?? null : null;
      const methodSrc = urlSrc ? null : (srcById.get(fanoutByTask.get(t.id) ?? -1) ?? null);
      const catSrc = urlSrc ?? methodSrc;
      return {
        ...t,
        domSampleId: domByHost.get(hostOf(t.sourceUrl)) ?? null,
        catalogSourceId: catSrc?.id ?? null,
        catalogSourceName: catSrc?.name ?? null,
        catalogSourceStatus: catSrc?.status ?? null,
        catalogVia: catSrc ? (methodSrc ? 'method' : 'source') : null,
        outreach: outreachByTask.get(t.id) ?? null,
        platformLabel: t.platformKey ? (labelMap.get(t.platformKey) ?? t.platformKey) : null,
        recommendedRole: recommendedAccountRole(t.platformKey, t.platformKey ? catMap.get(t.platformKey) ?? null : null),
        communitySeed: t.platformKey ? (gateMap.get(t.platformKey) ?? false) : false,
        seedGate: null,   // filled below (batched) for 🌱 community-seed tasks only
        readiness: readinessBucket(t.accountType, acct?.status ?? null),
        accountId: acct?.id ?? null,
        accountHandle: acct?.handle ?? null,
        accountStatus: acct?.status ?? null,
        has2fa: acct?.has2fa ?? false,
        authMethod: acct?.authMethod ?? null,
        hasProxy: acct?.hasProxy ?? false,
        hasProfile: acct?.hasProfile ?? false,
      };
    });

    // 🌱 community-seed readiness — resolve each gate-on task's (account × subreddit) brief
    // and attach the link gate (batched; only when there are community-seed tasks).
    const seedTasks = tasks.filter((t) => t.communitySeed && t.sourceUrl);
    if (seedTasks.length) {
      const gates = await resolveSeedGates(db, seedTasks.map((t) => ({ id: t.id, sourceUrl: t.sourceUrl, accountId: t.accountId })));
      for (const t of tasks) { const g = gates.get(t.id); if (g) t.seedGate = g; }
    }
    return tasks;
  } catch {
    return [];
  }
}

// Global /plays aggregate: every backlink-tracked project's tasks in one list, each tagged with its
// project (id/slug/label) so the shared BacklinksPage can render + act per-task. Reuses getBacklinkTasks
// per project (same resolved siteState), so a shared source shows once per site it applies to.
export async function getAllBacklinkTasks(
  projects: { id: string; name: string }[],
): Promise<BacklinkTask[]> {
  // Iterate every tracked SITE (not just projects that have a row) so live sites with
  // backlink tasks but no projects-table entry (e.g. paydochub, chatlt) still show up.
  // Build the platform catalog ONCE (was re-fetched 300 rows/~36ms per site = ~400ms wasted).
  const db = getDb();
  const catalog = db ? await buildPlatformCatalog(db) : undefined;
  const per = await Promise.all(
    BACKLINK_SITES.map(async (site) => {
      // A project id that resolves to this slug gives the drawer real project context; else use the slug itself.
      const projId = projects.find((p) => resolveSiteSlug(p.id) === site.slug)?.id ?? site.slug;
      const ts = await getBacklinkTasks(projId, catalog);
      return ts.map((t) => ({ ...t, projectId: projId, projectSlug: site.slug, projectLabel: site.label, projectEmoji: site.emoji }));
    }),
  );
  return per.flat();
}

// Set (or clear) the value tier of a backlink task — A/B/C to focus, null to unmark.
// Tier is task-level (applies across every site the source targets), stored in
// prep_payload.tier. The board renders a ★ badge + sorts tier A→B→C first.
export async function setBacklinkTier(taskId: number, tier: 'A' | 'B' | 'C' | null): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'no-db' };
  if (tier !== null && !['A', 'B', 'C'].includes(tier)) return { ok: false, error: 'bad tier' };
  try {
    if (tier === null) {
      await db.execute(sql`UPDATE human_tasks SET prep_payload = COALESCE(prep_payload, '{}'::jsonb) - 'tier', updated_at = now() WHERE id = ${taskId} AND platform_key = 'backlink'`);
    } else {
      await db.execute(sql`UPDATE human_tasks SET prep_payload = COALESCE(prep_payload, '{}'::jsonb) || jsonb_build_object('tier', to_jsonb(${tier}::text)), updated_at = now() WHERE id = ${taskId} AND platform_key = 'backlink'`);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 120) };
  }
}
