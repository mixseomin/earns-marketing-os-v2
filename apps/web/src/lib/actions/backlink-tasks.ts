'use server';

// Per-project backlink task surface (/p/[id]/backlinks). A backlink source is a
// shared cross-project entity (human_tasks platform_key='backlink', view `backlinks`);
// a project "owns" a task when its site slug is a key in site_status. We scope by that
// membership — same data as the cross-project Architect grid, filtered to one site.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { resolveSiteSlug } from '@/lib/backlink-sites';
import { detectPlatformKeyFromUrl, canonPlatformKey } from '@/lib/habitat-platform-map';
import { getBacklinkAccountType, readinessBucket, pickBestAccount, type BacklinkAccountType, type ReadinessBucket } from '@/lib/backlink-account-type';

export interface BacklinkTask {
  id: number;
  title: string;
  status: string;                 // row-level human_tasks.status
  siteState: string;              // this site's status (site_status[slug])
  siteLiveUrl: string | null;     // this site's placed URL (site_url[slug])
  sourceUrl: string | null;
  da: string | null;
  dofollow: string | null;
  traffic: string | null;
  rank: string | null;
  mechanism: string | null;
  draft: string | null;
  hasDraft: boolean;
  instructions: string | null;
  notes: string | null;
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
             draft, has_draft, instructions, notes, site_status, site_url, applies_to,
             publish_url, screenshot_url, assigned_user_id, assignee,
             (site_status->>${slug}) AS site_state,
             (site_url->>${slug})    AS site_live_url,
             created_at
      FROM backlinks
      WHERE jsonb_exists(site_status, ${slug})
      ORDER BY created_at DESC NULLS LAST, id DESC`);
    const base = (rows as unknown as Array<Record<string, unknown>>).map((r) => {
      const sourceUrl = (r.source_url as string | null) || null;
      const platformKey = sourceUrl ? (canonPlatformKey(detectPlatformKeyFromUrl(sourceUrl)) || null) : null;
      return {
        id: Number(r.id),
        title: String(r.title ?? ''),
        status: String(r.status ?? 'pending'),
        siteState: String(r.site_state ?? 'pending'),
        siteLiveUrl: (r.site_live_url as string | null) || null,
        sourceUrl,
        da: (r.da as string | null) || null,
        dofollow: (r.dofollow as string | null) || null,
        traffic: (r.traffic as string | null) || null,
        rank: (r.rank as string | null) || null,
        mechanism: (r.mechanism as string | null) || null,
        draft: (r.draft as string | null) || null,
        hasDraft: r.has_draft === 'ready',
        instructions: (r.instructions as string | null) || null,
        notes: (r.notes as string | null) || null,
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

    // Batched account + label lookup (no N+1): only platforms that can have an account.
    const lookupKeys = [...new Set(base.filter((t) => t.accountType !== 'no-account' && t.platformKey).map((t) => t.platformKey as string))];
    const labelMap = new Map<string, string>();
    const acctMap = new Map<string, { id: number; handle: string | null; status: string; has2fa: boolean; authMethod: string | null; hasProxy: boolean; hasProfile: boolean }>();
    if (lookupKeys.length) {
      const inList = sql.join(lookupKeys.map((k) => sql`${k}`), sql`, `);
      const [plats, accts] = await Promise.all([
        db.execute(sql`SELECT key, label FROM platforms WHERE key IN (${inList})`),
        // SECRET-SAFE: never select password_enc / api_token_enc / bot_token_enc.
        db.execute(sql`SELECT platform_key, id, handle, status, has_2fa, auth_method,
                       (proxy_id IS NOT NULL) AS has_proxy, (browser_profile_id IS NOT NULL) AS has_profile
                       FROM platform_accounts WHERE tenant_id = 'self' AND platform_key IN (${inList})`),
      ]);
      for (const p of plats as unknown as Array<{ key: string; label: string }>) labelMap.set(p.key, p.label);
      const byKey = new Map<string, Array<Record<string, unknown>>>();
      for (const a of accts as unknown as Array<Record<string, unknown>>) {
        const k = String(a.platform_key);
        (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(a);
      }
      for (const [k, list] of byKey) {
        const best = pickBestAccount(list as Array<{ status: string }>) as Record<string, unknown> | null;
        if (best) acctMap.set(k, { id: Number(best.id), handle: (best.handle as string | null) || null, status: String(best.status), has2fa: best.has_2fa === true, authMethod: (best.auth_method as string | null) || null, hasProxy: best.has_proxy === true, hasProfile: best.has_profile === true });
      }
    }

    return base.map((t): BacklinkTask => {
      const acct = t.platformKey ? acctMap.get(t.platformKey) ?? null : null;
      return {
        ...t,
        platformLabel: t.platformKey ? (labelMap.get(t.platformKey) ?? t.platformKey) : null,
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
