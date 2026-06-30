'use server';

// Per-project backlink task surface (/p/[id]/backlinks). A backlink source is a
// shared cross-project entity (human_tasks platform_key='backlink', view `backlinks`);
// a project "owns" a task when its site slug is a key in site_status. We scope by that
// membership — same data as the cross-project Architect grid, filtered to one site.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { resolveSiteSlug } from '@/lib/backlink-sites';

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
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ''),
      status: String(r.status ?? 'pending'),
      siteState: String(r.site_state ?? 'pending'),
      siteLiveUrl: (r.site_live_url as string | null) || null,
      sourceUrl: (r.source_url as string | null) || null,
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
    }));
  } catch {
    return [];
  }
}
