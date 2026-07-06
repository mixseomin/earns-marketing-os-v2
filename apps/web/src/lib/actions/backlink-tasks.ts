'use server';

// Per-project backlink task surface (/p/[id]/backlinks). A backlink source is a
// shared cross-project entity (human_tasks platform_key='backlink', view `backlinks`);
// a project "owns" a task when its site slug is a key in site_status. We scope by that
// membership — same data as the cross-project Architect grid, filtered to one site.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { resolveSiteSlug } from '@/lib/backlink-sites';
import { detectPlatformKeyFromUrl, canonPlatformKey } from '@/lib/habitat-platform-map';
import { getBacklinkAccountType, readinessBucket, pickBestAccount, recommendedAccountRole, type BacklinkAccountType, type ReadinessBucket, type AccountRole } from '@/lib/backlink-account-type';

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
  draft: string | null;
  draftShort: string | null;      // AI-condensed short version (persisted)
  draftImages: string[];          // optional images embedded in the draft (all formats)
  hasDraft: boolean;
  instructions: string | null;
  notes: string | null;
  workerNote: string | null;                       // staff free-text: result report + opinions
  blocker: { reason: string; at: string; paused?: boolean; origin?: number; shot?: string } | null;  // active blocker; paused = auto-held (sibling blocked); shot = screenshot URL
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
  readiness: ReadinessBucket;
  accountId: number | null;
  accountHandle: string | null;
  accountStatus: string | null;
  has2fa: boolean;
  authMethod: string | null;
  hasProxy: boolean;
  hasProfile: boolean;
}

const asObj = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

// List the backlink tasks that apply to a project's site. Returns [] if the project
// isn't a backlink-tracked site (resolveSiteSlug null).
export async function getBacklinkTasks(projectId: string): Promise<BacklinkTask[]> {
  const slug = resolveSiteSlug(projectId);
  if (!slug) return [];
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.execute(sql`
      SELECT id, title, status, source_url, da, dofollow, traffic, rank, mechanism,
             draft, draft_short, draft_images, has_draft, instructions, notes, site_status, site_url, applies_to,
             publish_url, screenshot_url, assigned_user_id, assignee,
             (site_status->>${slug}) AS site_state,
             (site_url->>${slug})    AS site_live_url,
             (site_done_at->>${slug})      AS site_done_at,
             (site_scheduled_at->>${slug}) AS site_scheduled_at,
             (site_submitted_at->>${slug}) AS site_submitted_at,
             (site_verify->${slug})        AS site_verify,
             worker_note, blocker,
             created_at
      FROM backlinks
      WHERE jsonb_exists(site_status, ${slug})
      ORDER BY created_at DESC NULLS LAST, id DESC`);
    // Nhận diện platform curated qua CATALOG (signup_url host) — không chỉ HOSTNAME_TO_PLATFORM regex.
    // Platform mới thêm vào catalog (chưa có regex) vẫn được nhận → account KHỚP (cùng key reconcile bên
    // ext). Site LẠ (không regex + không catalog) → null → no-account default (KHÔNG false-block). 1 query.
    const catSlug = new Map<string, string>();
    const allKeys = new Set<string>();   // every catalog key — many are just the normalized hostname
    try {
      const cat = await db.execute(sql`SELECT key, signup_url FROM platforms`);
      for (const row of (cat as unknown as Array<{ key: string; signup_url: string | null }>)) {
        allKeys.add(row.key);
        if (!row.signup_url) continue;
        try { const h = new URL(row.signup_url).hostname.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); if (h && !catSlug.has(h)) catSlug.set(h, row.key); } catch { /* skip bad url */ }
      }
    } catch { /* catalog unavailable → regex-only fallback */ }
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
        draft: (r.draft as string | null) || null,
        draftShort: (r.draft_short as string | null) || null,
        draftImages: Array.isArray(r.draft_images) ? (r.draft_images as string[]) : [],
        hasDraft: r.has_draft === 'ready',
        instructions: (r.instructions as string | null) || null,
        notes: (r.notes as string | null) || null,
        workerNote: (r.worker_note as string | null) || null,
        blocker: (r.blocker && typeof r.blocker === 'object' && !Array.isArray(r.blocker))
          ? (r.blocker as { reason: string; at: string; paused?: boolean; origin?: number; shot?: string }) : null,
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
    const acctMap = new Map<string, Acct>();
    const acctById = new Map<number, Acct>();
    if (lookupKeys.length) {
      const inList = sql.join(lookupKeys.map((k) => sql`${k}`), sql`, `);
      const [plats, accts] = await Promise.all([
        db.execute(sql`SELECT key, label, category FROM platforms WHERE key IN (${inList})`),
        // SECRET-SAFE: never select password_enc / api_token_enc / bot_token_enc.
        db.execute(sql`SELECT platform_key, id, handle, status, has_2fa, auth_method,
                       (proxy_id IS NOT NULL) AS has_proxy, (browser_profile_id IS NOT NULL) AS has_profile
                       FROM platform_accounts WHERE tenant_id = 'self' AND platform_key IN (${inList})`),
      ]);
      for (const p of plats as unknown as Array<{ key: string; label: string; category: string | null }>) { labelMap.set(p.key, p.label); if (p.category) catMap.set(p.key, p.category); }
      const byKey = new Map<string, Array<Record<string, unknown>>>();
      for (const a of accts as unknown as Array<Record<string, unknown>>) {
        acctById.set(Number(a.id), asAcct(a));
        const k = String(a.platform_key);
        (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(a);
      }
      for (const [k, list] of byKey) {
        const best = pickBestAccount(list as Array<{ status: string }>) as Record<string, unknown> | null;
        if (best) acctMap.set(k, asAcct(best));
      }
    }

    return base.map((t): BacklinkTask => {
      const overrideId = overrideByTask.get(t.id);
      const acct = (overrideId != null && acctById.get(overrideId)) || (t.platformKey ? acctMap.get(t.platformKey) ?? null : null);
      return {
        ...t,
        platformLabel: t.platformKey ? (labelMap.get(t.platformKey) ?? t.platformKey) : null,
        recommendedRole: recommendedAccountRole(t.platformKey, t.platformKey ? catMap.get(t.platformKey) ?? null : null),
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
  } catch {
    return [];
  }
}
