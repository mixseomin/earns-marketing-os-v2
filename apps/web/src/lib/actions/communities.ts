'use server';

// Communities registry — central list of every habitat (subreddit / forum / community)
// with its metrics + rules + link-gate thresholds + our standing. Powers the global
// /communities vault and its per-project filter (?project=<id>). A subreddit = one
// habitat row; the gate (link-readiness) reads habitats.min_* — this is where the
// operator SEES and tunes those, instead of them being buried per-brief in /seeding.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export interface CommunityRow {
  id: number;
  name: string;
  url: string | null;
  platformKey: string | null;
  projectId: string | null;
  members: number;
  privacy: string;
  communityType: string;
  status: string;
  minAgeDays: number;
  minKarma: number;
  minPosts: number;
  linksAllowedAfter: string;
  postingRules: string;
  description: string;
  // our standing here (across all briefs on this habitat)
  briefs: number;
  joined: number;
  seeds: number;      // live, link-free posts landed = the seed track-record the gate counts
}

const rows = <T = Record<string, unknown>>(r: unknown): T[] => (r as { rows?: T[] })?.rows ?? (r as T[]) ?? [];

// Platform keys with the link gate on → their communities are the 🌱 community-seed class.
export async function gatedPlatformKeys(): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`SELECT key FROM platforms WHERE link_gate_enabled = true`);
  return rows<{ key: string }>(r).map((x) => String(x.key));
}

export async function listCommunities(projectId?: string): Promise<CommunityRow[]> {
  const db = getDb();
  if (!db) return [];
  const where = projectId ? sql`WHERE h.project_id = ${projectId}` : sql``;
  const habRaw = await db.execute(sql`
    SELECT h.id, h.name, h.url, h.platform_key, h.project_id,
           coalesce(h.members,0) AS members, coalesce(h.privacy,'') AS privacy,
           coalesce(h.community_type,'') AS community_type, coalesce(h.status,'') AS status,
           coalesce(h.min_account_age_days,0) AS min_age, coalesce(h.min_karma,0) AS min_karma,
           coalesce(h.min_posts,0) AS min_posts, coalesce(h.links_allowed_after,'') AS links_allowed_after,
           coalesce(h.posting_rules,'') AS posting_rules, coalesce(h.description,'') AS description
    FROM habitats h ${where}
    ORDER BY h.platform_key NULLS LAST, coalesce(h.members,0) DESC, h.id`);
  const habs = rows(habRaw);
  const ids = habs.map((h) => Number(h.id));
  if (!ids.length) return [];

  // Standing per habitat — batched (one grouped query, not a per-row subquery).
  const idList = sql.join(ids.map((i) => sql`${i}`), sql`, `);
  const stRaw = await db.execute(sql`
    SELECT b.habitat_id,
           count(DISTINCT b.id) AS briefs,
           count(DISTINCT b.id) FILTER (WHERE b.join_status = 'joined') AS joined,
           count(c.id) FILTER (WHERE c.post_url IS NOT NULL AND (c.content_type IS NULL OR c.content_type <> 'link')
                               AND (c.post_lifecycle IS NULL OR c.post_lifecycle NOT IN ('removed-by-mod','self-deleted','ghosted'))) AS seeds
    FROM community_briefs b LEFT JOIN cards c ON c.brief_id = b.id
    WHERE b.habitat_id IN (${idList}) GROUP BY b.habitat_id`);
  const st = new Map<number, { briefs: number; joined: number; seeds: number }>();
  for (const r of rows(stRaw)) st.set(Number(r.habitat_id), { briefs: Number(r.briefs), joined: Number(r.joined), seeds: Number(r.seeds) });

  return habs.map((h): CommunityRow => {
    const s = st.get(Number(h.id)) ?? { briefs: 0, joined: 0, seeds: 0 };
    return {
      id: Number(h.id), name: String(h.name ?? ''), url: (h.url as string) || null,
      platformKey: (h.platform_key as string) || null, projectId: (h.project_id as string) || null,
      members: Number(h.members), privacy: String(h.privacy), communityType: String(h.community_type),
      status: String(h.status), minAgeDays: Number(h.min_age), minKarma: Number(h.min_karma), minPosts: Number(h.min_posts),
      linksAllowedAfter: String(h.links_allowed_after), postingRules: String(h.posting_rules), description: String(h.description),
      briefs: s.briefs, joined: s.joined, seeds: s.seeds,
    };
  });
}
