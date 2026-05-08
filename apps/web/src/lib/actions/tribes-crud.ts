'use server';

// CRUD for tribes (audience identity) + habitats (concrete community).
// Read paths live in lib/data.ts (listTribes, listHabitats); this file
// owns mutations + revalidation.

import { revalidatePath } from 'next/cache';
import { eq, and, asc, inArray, sql, isNull } from 'drizzle-orm';
import { getDb, tribes, habitats, platforms } from '@mos2/db';
import { fetchDirectusCommunitiesByIds, directusEnabled } from '../bridge/directus';
import { platformKeysForHabitatKind } from '../habitat-platform-map';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

// Cross-project list of habitats using a given platform — used by
// PlatformFormModal to show "📍 Used by N communities" reverse view.
export async function listCommunitiesByPlatform(platformKey: string, limit = 50): Promise<Array<{
  id: number;
  name: string;
  kind: string;
  url: string | null;
  members: number;
  projectId: string;
  projectName: string;
  tribeName: string | null;
}>> {
  if (!platformKey) return [];
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT h.id, h.name, h.kind, h.url, h.members, h.project_id,
           pr.name AS project_name,
           t.name AS tribe_name
    FROM habitats h
    LEFT JOIN projects pr ON pr.id = h.project_id
    LEFT JOIN tribes t ON t.id = h.tribe_id
    WHERE h.platform_key = ${platformKey}
    ORDER BY h.members DESC NULLS LAST, h.name ASC
    LIMIT ${limit}
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ''),
    kind: String(r.kind ?? ''),
    url: r.url ? String(r.url) : null,
    members: Number(r.members ?? 0),
    projectId: String(r.project_id ?? ''),
    projectName: String(r.project_name ?? r.project_id ?? ''),
    tribeName: r.tribe_name ? String(r.tribe_name) : null,
  }));
}

// Cross-project habitat search — used by /platforms page so user can find
// a community (e.g. "Lý Số") even if they don't know which project it's
// scoped to. Returns habitat + project name + platform key.
export async function searchHabitatsAcrossProjects(q: string, limit = 20): Promise<Array<{
  id: number;
  name: string;
  kind: string;
  url: string | null;
  members: number;
  projectId: string;
  projectName: string;
  platformKey: string | null;
  platformLabel: string | null;
  tribeName: string | null;
}>> {
  const ql = q.trim();
  if (!ql) return [];
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT h.id, h.name, h.kind, h.url, h.members, h.project_id,
           h.platform_key, p.label AS platform_label,
           pr.name AS project_name,
           t.name AS tribe_name
    FROM habitats h
    LEFT JOIN projects pr ON pr.id = h.project_id
    LEFT JOIN platforms p ON p.key = h.platform_key
    LEFT JOIN tribes t ON t.id = h.tribe_id
    WHERE h.name ILIKE ${'%' + ql + '%'}
       OR h.url  ILIKE ${'%' + ql + '%'}
    ORDER BY h.members DESC NULLS LAST, h.name ASC
    LIMIT ${limit}
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ''),
    kind: String(r.kind ?? ''),
    url: r.url ? String(r.url) : null,
    members: Number(r.members ?? 0),
    projectId: String(r.project_id ?? ''),
    projectName: String(r.project_name ?? r.project_id ?? ''),
    platformKey: r.platform_key ? String(r.platform_key) : null,
    platformLabel: r.platform_label ? String(r.platform_label) : null,
    tribeName: r.tribe_name ? String(r.tribe_name) : null,
  }));
}

// Lightweight read for client components that need to populate a tribe
// dropdown inside a modal. Heavier `listTribes` in lib/data.ts is for
// server pages that already have full project context.
export async function listTribesForProject(projectId: string) {
  const db = ensureDb();
  const rows = await db.select().from(tribes)
    .where(eq(tribes.projectId, projectId))
    .orderBy(asc(tribes.name));
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    slug: r.slug,
    name: r.name,
    descText: r.descText,
    signal: r.signal,
    sentiment: r.sentiment,
    lifecycle: r.lifecycle,
    lexicon: (r.lexicon as string[]) ?? [],
    avoid: (r.avoid as string[]) ?? [],
    psychographic: r.psychographic,
    importedFrom: r.importedFrom,
  }));
}

// Back-fill habitats.platform_key. Two passes:
//   1. Imported-from-Directus habitats — read Directus community.platform string,
//      match to MOS2 platforms catalog.
//   2. Kind-derived habitats — kind=subreddit → reddit, fb-group → facebook etc.
//      (uses platformKeysForHabitatKind map, only lock when platform exists in catalog)
//
// Idempotent (skips already-linked habitats). Returns counts + any names from
// Directus that didn't match a MOS2 platform.
export async function syncHabitatPlatformsFromDirectus(): Promise<{
  ok: boolean; linked: number; skipped: number; missing: string[]; error?: string;
}> {
  const db = ensureDb();
  // Find ALL habitats not yet linked to a platform (any source).
  const orphans = await db
    .select({ id: habitats.id, importedFrom: habitats.importedFrom, kind: habitats.kind })
    .from(habitats)
    .where(isNull(habitats.platformKey));
  if (orphans.length === 0) return { ok: true, linked: 0, skipped: 0, missing: [] };

  // Load MOS2 platforms for matching
  const allPlatforms = await db.select({ key: platforms.key, label: platforms.label }).from(platforms);
  const byLowerKey   = new Map(allPlatforms.map((p) => [p.key.toLowerCase(), p.key]));
  const byLowerLabel = new Map(allPlatforms.map((p) => [p.label.toLowerCase(), p.key]));

  // Pass 1: Directus-imported habitats — read community.platform string.
  const directusOrphans = orphans.filter((h) => (h.importedFrom ?? '').startsWith('directus:'));
  const cmap = new Map<string, { id: string; platform: string | null; platform_id: string | null }>();
  if (directusEnabled() && directusOrphans.length > 0) {
    const directusIds = directusOrphans
      .map((h) => (h.importedFrom ?? '').replace(/^directus:/, ''))
      .filter(Boolean);
    try {
      const communities = await fetchDirectusCommunitiesByIds(directusIds);
      for (const c of communities) cmap.set(c.id, c);
    } catch { /* non-fatal — fall through to kind-derive pass */ }
  }

  let linked = 0;
  let skipped = 0;
  const missing: string[] = [];
  for (const h of orphans) {
    let platformKey: string | null = null;

    // Try Directus community.platform first
    const did = (h.importedFrom ?? '').replace(/^directus:/, '');
    const c = did ? cmap.get(did) : null;
    if (c?.platform) {
      const candidate = c.platform.trim();
      const candLower = candidate.toLowerCase();
      platformKey = byLowerKey.get(candLower) ?? byLowerLabel.get(candLower) ?? null;
      if (!platformKey && candidate && !missing.includes(candidate)) missing.push(candidate);
    }

    // Fallback: kind-derive (subreddit → reddit, fb-group → facebook, ...)
    if (!platformKey) {
      const fromKind = platformKeysForHabitatKind(h.kind ?? '');
      if (fromKind && fromKind.length > 0) {
        const candidate = fromKind[0]!;
        if (byLowerKey.has(candidate.toLowerCase())) platformKey = candidate;
        else if (!missing.includes(candidate)) missing.push(candidate);
      }
    }

    if (!platformKey) { skipped += 1; continue; }
    await db.update(habitats).set({ platformKey, updatedAt: new Date() }).where(eq(habitats.id, h.id));
    linked += 1;
  }
  revalidatePath('/p/[id]/tribes', 'page');
  return { ok: true, linked, skipped, missing };
}

function toSlug(s: string): string {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip combining diacritics (vi-VN)
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'tribe';
}

// ── tribes ────────────────────────────────────────────────────────

export interface TribeInput {
  name: string;
  slug?: string;                 // auto-derived from name if omitted
  descText?: string;
  signal?: string;
  sentiment?: number;            // -100..100
  lifecycle?: 'discovery' | 'active' | 'saturated' | 'fading' | 'defunct';
  lexicon?: string[];
  avoid?: string[];
  psychographic?: string;
}

export async function createTribe(
  projectId: string, input: TribeInput,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!input.name?.trim()) return { ok: false, error: 'name required' };
  const db = ensureDb();
  const slug = (input.slug?.trim() || toSlug(input.name));
  try {
    const inserted = await db.insert(tribes).values({
      tenantId: TENANT,
      projectId,
      slug,
      name: input.name.trim(),
      descText: input.descText ?? '',
      signal: input.signal ?? '',
      sentiment: input.sentiment ?? 0,
      lifecycle: input.lifecycle ?? 'discovery',
      lexicon: input.lexicon ?? [],
      avoid: input.avoid ?? [],
      psychographic: input.psychographic ?? '',
    }).returning({ id: tribes.id });
    revalidatePath(`/p/${projectId}/tribes`);
    return { ok: true, id: inserted[0]?.id };
  } catch (e: unknown) {
    const msg = (e instanceof Error) ? e.message : String(e);
    if (msg.includes('tribes_project_slug_uniq')) {
      return { ok: false, error: `slug "${slug}" already exists in this project` };
    }
    return { ok: false, error: msg };
  }
}

export async function updateTribe(
  projectId: string, id: number, patch: Partial<TribeInput>,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name != null)          set.name = patch.name.trim();
  if (patch.slug != null)          set.slug = patch.slug.trim() || toSlug(patch.name ?? '');
  if (patch.descText != null)      set.descText = patch.descText;
  if (patch.signal != null)        set.signal = patch.signal;
  if (patch.sentiment != null)     set.sentiment = patch.sentiment;
  if (patch.lifecycle != null)     set.lifecycle = patch.lifecycle;
  if (patch.lexicon != null)       set.lexicon = patch.lexicon;
  if (patch.avoid != null)         set.avoid = patch.avoid;
  if (patch.psychographic != null) set.psychographic = patch.psychographic;
  try {
    await db.update(tribes).set(set).where(and(eq(tribes.id, id), eq(tribes.projectId, projectId)));
    revalidatePath(`/p/${projectId}/tribes`);
    return { ok: true };
  } catch (e: unknown) {
    const msg = (e instanceof Error) ? e.message : String(e);
    if (msg.includes('tribes_project_slug_uniq')) {
      return { ok: false, error: 'slug already exists in this project' };
    }
    return { ok: false, error: msg };
  }
}

export async function deleteTribe(
  projectId: string, id: number,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  // Habitats with tribe_id=this will have their FK set NULL (ON DELETE
  // CASCADE on the FK is set, so they DELETE actually — see schema).
  // Re-check schema before relying on either behaviour.
  await db.delete(tribes).where(and(eq(tribes.id, id), eq(tribes.projectId, projectId)));
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}

// ── habitats ──────────────────────────────────────────────────────

export interface HabitatInput {
  name: string;
  kind?: string;                 // subreddit|fb-group|discord|forum|hashtag|...
  url?: string | null;
  platformKey?: string | null;   // explicit platform link (auto-derived from kind for known kinds)
  technologyKey?: string | null; // forum engine override (vbulletin, xenforo, phpbb...)
  members?: number;
  activity?: string;
  scrapeFrequency?: 'live' | 'manual' | 'weekly' | 'comments';
  health?: 'ok' | 'warn' | 'bad';
  tribeId?: number | null;       // optional link to a tribe
  // Outreach meta
  language?: string;             // vi|en|zh|multi|...
  communityType?: string;        // discussion|news|q-a|portfolio|sharing|other
  status?: 'target' | 'engaged' | 'saturated' | 'banned' | 'dormant' | 'defunct';
  modStrictness?: 'low' | 'medium' | 'high' | '';
  postingRules?: string;
  postingRulesUrl?: string;
  minAccountAgeDays?: number;
  minKarma?: number;
  minPosts?: number;
  linksAllowedAfter?: string;
  dominantTopics?: string[];
  forbiddenTopics?: string[];
  bestPostTimes?: string;
}

export async function createHabitat(
  projectId: string, input: HabitatInput,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!input.name?.trim()) return { ok: false, error: 'name required' };
  const db = ensureDb();
  const inserted = await db.insert(habitats).values({
    tenantId: TENANT,
    projectId,
    tribeId: input.tribeId ?? null,
    kind: input.kind ?? 'forum',
    name: input.name.trim(),
    url: input.url ?? null,
    platformKey: input.platformKey ?? null,
    technologyKey: input.technologyKey ?? null,
    members: input.members ?? 0,
    activity: input.activity ?? '',
    scrapeFrequency: input.scrapeFrequency ?? 'manual',
    health: input.health ?? 'ok',
    language: input.language ?? '',
    communityType: input.communityType ?? '',
    status: input.status ?? 'target',
    modStrictness: input.modStrictness ?? '',
    postingRules: input.postingRules ?? '',
    postingRulesUrl: input.postingRulesUrl ?? '',
    minAccountAgeDays: input.minAccountAgeDays ?? 0,
    minKarma: input.minKarma ?? 0,
    minPosts: input.minPosts ?? 0,
    linksAllowedAfter: input.linksAllowedAfter ?? '',
    dominantTopics: input.dominantTopics ?? [],
    forbiddenTopics: input.forbiddenTopics ?? [],
    bestPostTimes: input.bestPostTimes ?? '',
  }).returning({ id: habitats.id });
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true, id: inserted[0]?.id };
}

export async function updateHabitat(
  projectId: string, id: number, patch: Partial<HabitatInput>,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name != null)            set.name = patch.name.trim();
  if (patch.kind != null)            set.kind = patch.kind;
  if (patch.url !== undefined)       set.url = patch.url;
  if (patch.platformKey !== undefined) set.platformKey = patch.platformKey;
  if (patch.technologyKey !== undefined) set.technologyKey = patch.technologyKey;
  if (patch.members != null)         set.members = patch.members;
  if (patch.activity != null)        set.activity = patch.activity;
  if (patch.scrapeFrequency != null) set.scrapeFrequency = patch.scrapeFrequency;
  if (patch.health != null)          set.health = patch.health;
  if (patch.tribeId !== undefined)   set.tribeId = patch.tribeId;
  if (patch.language != null)            set.language = patch.language;
  if (patch.communityType != null)       set.communityType = patch.communityType;
  if (patch.status != null)              set.status = patch.status;
  if (patch.modStrictness != null)       set.modStrictness = patch.modStrictness;
  if (patch.postingRules != null)        set.postingRules = patch.postingRules;
  if (patch.postingRulesUrl != null)     set.postingRulesUrl = patch.postingRulesUrl;
  if (patch.minAccountAgeDays != null)   set.minAccountAgeDays = patch.minAccountAgeDays;
  if (patch.minKarma != null)            set.minKarma = patch.minKarma;
  if (patch.minPosts != null)            set.minPosts = patch.minPosts;
  if (patch.linksAllowedAfter != null)   set.linksAllowedAfter = patch.linksAllowedAfter;
  if (patch.dominantTopics != null)      set.dominantTopics = patch.dominantTopics;
  if (patch.forbiddenTopics != null)     set.forbiddenTopics = patch.forbiddenTopics;
  if (patch.bestPostTimes != null)       set.bestPostTimes = patch.bestPostTimes;
  await db.update(habitats).set(set).where(and(eq(habitats.id, id), eq(habitats.projectId, projectId)));
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}

export async function deleteHabitat(
  projectId: string, id: number,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  // community_briefs FK has ON DELETE CASCADE — briefs for this habitat
  // are dropped automatically.
  await db.delete(habitats).where(and(eq(habitats.id, id), eq(habitats.projectId, projectId)));
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}
