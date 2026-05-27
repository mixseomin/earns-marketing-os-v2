'use server';

// CRUD for tribes (audience identity) + habitats (concrete community).
// Read paths live in lib/data.ts (listTribes, listHabitats); this file
// owns mutations + revalidation.

import { revalidatePath } from 'next/cache';
import { eq, ne, and, asc, inArray, sql, isNull } from 'drizzle-orm';
import { getDb, tribes, habitats, habitatTribes, platforms, cards, communityBriefs, platformAccounts } from '@mos2/db';
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
  // habitats.tribe_id FK is ON DELETE CASCADE — deleting a tribe that is
  // some habitat's PRIMARY would otherwise delete the habitat itself.
  // M2M-safe: first repoint each affected habitat to another tribe from
  // its remaining join set (or NULL), promote that to primary, THEN
  // delete the tribe (habitat_tribes rows for it cascade away cleanly).
  const affected = await db.select({ id: habitats.id }).from(habitats)
    .where(and(eq(habitats.tribeId, id), eq(habitats.projectId, projectId)));
  for (const h of affected) {
    const others = await db.select({ tribeId: habitatTribes.tribeId })
      .from(habitatTribes)
      .where(and(eq(habitatTribes.habitatId, h.id), ne(habitatTribes.tribeId, id)));
    const next = others[0]?.tribeId ?? null;
    await db.update(habitats).set({ tribeId: next, updatedAt: new Date() })
      .where(eq(habitats.id, h.id));
    if (next != null) {
      await db.update(habitatTribes).set({ isPrimary: sql`(${habitatTribes.tribeId} = ${next})` })
        .where(eq(habitatTribes.habitatId, h.id));
    }
  }
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
  iconUrl?: string | null;       // CDN icon URL (Discord guild icon, subreddit icon...)
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
  // Override platform.allowed_formats cho community cụ thể. [] = empty array
  // được lưu (override = không cho format nào — rare). null = clear override.
  allowedFormatsOverride?: string[] | null;
  // Voice profile (lurker|regular|shitposter|edgelord|expert|hype) — AI gen tone.
  voiceProfile?: string;
  voiceNotes?: string;
  fewShotExamples?: Array<{ title?: string; body: string; whyItWorks?: string }> | null;
  visualStyleDescriptor?: string | null;
  // migration 0059: Reddit sidebar metadata
  createdAtSource?: Date | string | null;
  privacy?: 'public' | 'restricted' | 'private' | '';
  weeklyVisitors?: number;
  weeklyContributions?: number;
  // migration 0063
  description?: string;
  // migration 0074: habitat dùng AI-content detector
  aiContentDetection?: boolean;
  aiDetectionNote?: string;
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
    iconUrl: input.iconUrl ?? null,
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
    allowedFormatsOverride: input.allowedFormatsOverride ?? null,
    voiceProfile: input.voiceProfile ?? 'regular',
    voiceNotes: input.voiceNotes ?? '',
    fewShotExamples: input.fewShotExamples ?? null,
    visualStyleDescriptor: input.visualStyleDescriptor ?? null,
    createdAtSource: input.createdAtSource ? new Date(input.createdAtSource as string | Date) : null,
    privacy: input.privacy ?? '',
    weeklyVisitors: input.weeklyVisitors ?? 0,
    weeklyContributions: input.weeklyContributions ?? 0,
    description: input.description ?? '',
    aiContentDetection: input.aiContentDetection ?? false,
    aiDetectionNote: input.aiDetectionNote ?? null,
  }).returning({ id: habitats.id });
  const newId = inserted[0]?.id;
  // M2M: mirror the (single) tribe picked at create-time as the primary
  // row in habitat_tribes. Multi-tribe is managed afterwards via the
  // edit modal / AI assign tool.
  if (newId != null && input.tribeId != null) {
    await db.insert(habitatTribes)
      .values({ tenantId: TENANT, habitatId: newId, tribeId: input.tribeId, isPrimary: true })
      .onConflictDoNothing();
  }
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true, id: newId };
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
  if (patch.iconUrl !== undefined)   set.iconUrl = patch.iconUrl;
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
  if (patch.voiceProfile != null)        set.voiceProfile = patch.voiceProfile;
  if (patch.voiceNotes != null)          set.voiceNotes = patch.voiceNotes;
  if (patch.fewShotExamples !== undefined) set.fewShotExamples = patch.fewShotExamples;
  if (patch.visualStyleDescriptor !== undefined) set.visualStyleDescriptor = patch.visualStyleDescriptor;
  // migration 0059: Reddit sidebar metadata
  if (patch.createdAtSource !== undefined)   set.createdAtSource = patch.createdAtSource ? new Date(patch.createdAtSource as string | Date) : null;
  if (patch.privacy != null)                 set.privacy = patch.privacy;
  if (patch.weeklyVisitors != null)          set.weeklyVisitors = patch.weeklyVisitors;
  if (patch.weeklyContributions != null)     set.weeklyContributions = patch.weeklyContributions;
  // migration 0063
  if (patch.description != null)             set.description = patch.description;
  // migration 0074
  if (patch.aiContentDetection != null)      set.aiContentDetection = patch.aiContentDetection;
  if (patch.aiDetectionNote !== undefined)   set.aiDetectionNote = patch.aiDetectionNote;
  // allowed_formats_override: nếu đổi → tính diff để auto-restore (types
  // được ADD lại sau khi từng bị remove). Archive cho types REMOVED là
  // responsibility của client (qua confirm dialog gọi
  // archiveCardsByTypesForHabitat riêng).
  let restoredTypes: string[] = [];
  if (patch.allowedFormatsOverride !== undefined) {
    const prev = await db.execute(sql`
      SELECT allowed_formats_override FROM habitats
      WHERE id = ${id} AND project_id = ${projectId} LIMIT 1
    `);
    const prevList = (prev as unknown as Array<{ allowed_formats_override: unknown }>)[0]?.allowed_formats_override;
    const prevSet = new Set(Array.isArray(prevList) ? (prevList as string[]) : []);
    const newSet = new Set(Array.isArray(patch.allowedFormatsOverride) ? (patch.allowedFormatsOverride as string[]) : []);
    // Types được thêm lại = trong new mà không trong prev (chỉ áp dụng khi
    // CẢ HAI là array; nếu prev null/new null thì skip auto-restore — case
    // chuyển sang inherit/default nên broad restore không an toàn).
    if (Array.isArray(patch.allowedFormatsOverride) && Array.isArray(prevList)) {
      restoredTypes = [...newSet].filter((t) => !prevSet.has(t));
    }
    set.allowedFormatsOverride = patch.allowedFormatsOverride;
  }
  await db.update(habitats).set(set).where(and(eq(habitats.id, id), eq(habitats.projectId, projectId)));
  // Auto-restore archived cards của types vừa được tick lại.
  if (restoredTypes.length > 0) {
    await db.execute(sql`
      UPDATE cards SET archived_at = NULL, archived_reason = NULL, updated_at = now()
      WHERE archived_at IS NOT NULL
        AND content_type IN (${sql.join(restoredTypes, sql`, `)})
        AND archived_reason LIKE 'format-removed:%'
        AND brief_id IN (
          SELECT id FROM community_briefs
          WHERE habitat_id = ${id} AND project_id = ${projectId}
        )
    `);
  }
  // M2M sync for the legacy single-tribe field. We do NOT wipe secondary
  // tribes here — this path only changes WHICH tribe is primary.
  //   tribeId = null   → unlink everything (no primary ⇒ no tribes)
  //   tribeId = <id>   → ensure that tribe is linked + is the primary,
  //                      keep other (secondary) links intact.
  if (patch.tribeId !== undefined) {
    if (patch.tribeId == null) {
      await db.delete(habitatTribes).where(eq(habitatTribes.habitatId, id));
    } else {
      await db.insert(habitatTribes)
        .values({ tenantId: TENANT, habitatId: id, tribeId: patch.tribeId, isPrimary: true })
        .onConflictDoNothing();
      await db.update(habitatTribes)
        .set({ isPrimary: sql`(${habitatTribes.tribeId} = ${patch.tribeId})` })
        .where(eq(habitatTribes.habitatId, id));
    }
  }
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}

// ── M2M tribe set (full replace) ──────────────────────────────────
// Source of truth for a habitat's COMPLETE tribe set. Replaces all
// habitat_tribes rows + syncs the denormalized habitats.tribe_id mirror
// to the chosen primary. Used by the AI assign modal + the edit form's
// multi-tribe picker. Invalid tribe ids (not in project) are dropped.
export async function setHabitatTribes(
  projectId: string, habitatId: number,
  tribeIds: number[], primaryTribeId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const h = await db.select({ id: habitats.id }).from(habitats)
    .where(and(eq(habitats.id, habitatId), eq(habitats.projectId, projectId))).limit(1);
  if (!h.length) return { ok: false, error: 'habitat not found in project' };
  const projTribes = await db.select({ id: tribes.id }).from(tribes)
    .where(and(eq(tribes.projectId, projectId), eq(tribes.tenantId, TENANT)));
  const valid = new Set(projTribes.map((t) => t.id));
  const ids = [...new Set(tribeIds.filter((x) => valid.has(x)))];
  const primary: number | null =
    primaryTribeId != null && ids.includes(primaryTribeId) ? primaryTribeId : (ids[0] ?? null);
  await db.delete(habitatTribes).where(eq(habitatTribes.habitatId, habitatId));
  if (ids.length) {
    await db.insert(habitatTribes).values(
      ids.map((tid) => ({ tenantId: TENANT, habitatId, tribeId: tid, isPrimary: tid === primary })),
    );
  }
  await db.update(habitats).set({ tribeId: primary, updatedAt: new Date() })
    .where(and(eq(habitats.id, habitatId), eq(habitats.projectId, projectId)));
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}

// Read the full tribe-id set for a habitat (primary first).
export async function listHabitatTribeIds(habitatId: number): Promise<number[]> {
  const db = ensureDb();
  const rows = await db.select({ tribeId: habitatTribes.tribeId, isPrimary: habitatTribes.isPrimary })
    .from(habitatTribes).where(eq(habitatTribes.habitatId, habitatId));
  return rows.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((r) => r.tribeId);
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

// Bulk re-assign habitats → tribe SET. Used by AIHabitatTribesModal to
// apply AI classification in one shot. Each assignment fully replaces a
// habitat's tribe set (primary + secondaries). Invalid/foreign ids are
// dropped per-habitat so a partial-bad payload still applies good rows.
export async function bulkAssignHabitatTribe(
  projectId: string,
  assignments: Array<{ habitatId: number; tribeIds: number[]; primaryTribeId: number | null }>,
): Promise<{ ok: boolean; updated: number; error?: string }> {
  const db = ensureDb();
  if (assignments.length === 0) return { ok: true, updated: 0 };
  const projTribes = await db.select({ id: tribes.id })
    .from(tribes).where(and(eq(tribes.projectId, projectId), eq(tribes.tenantId, TENANT)));
  const valid = new Set(projTribes.map((t) => t.id));
  const habRows = await db.select({ id: habitats.id }).from(habitats)
    .where(eq(habitats.projectId, projectId));
  const validHab = new Set(habRows.map((h) => h.id));
  let updated = 0;
  for (const a of assignments) {
    if (!validHab.has(a.habitatId)) continue;
    const ids = [...new Set(a.tribeIds.filter((x) => valid.has(x)))];
    const primary = a.primaryTribeId != null && ids.includes(a.primaryTribeId)
      ? a.primaryTribeId : (ids[0] ?? null);
    await db.delete(habitatTribes).where(eq(habitatTribes.habitatId, a.habitatId));
    if (ids.length) {
      await db.insert(habitatTribes).values(
        ids.map((tid) => ({ tenantId: TENANT, habitatId: a.habitatId, tribeId: tid, isPrimary: tid === primary })),
      );
    }
    await db.update(habitats).set({ tribeId: primary, updatedAt: new Date() })
      .where(and(eq(habitats.id, a.habitatId), eq(habitats.projectId, projectId)));
    updated++;
  }
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true, updated };
}

// ── Format support change resolution ──────────────────────────────
// Khi user bỏ 1 format support ở habitat (allowed_formats_override),
// bài dạng đó trong cards thuộc mọi brief của habitat này trở thành
// "orphan". Pre-save: count theo type. Save xong: archive (soft) với
// archived_reason='format-removed:<type>'. Bật lại format → auto-unarchive.

export interface AffectedCardsByType {
  contentType: string;
  count: number;
}

// Count cards ACTIVE (chưa archived) của habitat group theo content_type.
// Dùng để detect orphan trước khi save habitat.allowed_formats_override.
export async function countCardsByContentTypeForHabitat(
  habitatId: number,
): Promise<AffectedCardsByType[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT c.content_type AS ct, count(*)::int AS n
      FROM cards c
      JOIN community_briefs b ON b.id = c.brief_id
     WHERE b.habitat_id = ${habitatId} AND c.archived_at IS NULL
     GROUP BY c.content_type
     ORDER BY count(*) DESC
  `);
  return (rows as unknown as Array<{ ct: string; n: number }>)
    .map((r) => ({ contentType: String(r.ct ?? 'text'), count: Number(r.n) }));
}

// Soft-archive cards ở habitat này có content_type nằm trong list. Reason
// dùng cho auto-restore khi bật lại.
export async function archiveCardsByTypesForHabitat(
  projectId: string, habitatId: number, types: string[],
): Promise<{ ok: boolean; archived: number }> {
  if (types.length === 0) return { ok: true, archived: 0 };
  const db = ensureDb();
  const result = await db.execute(sql`
    UPDATE cards SET archived_at = now(),
      archived_reason = 'format-removed:' || content_type,
      updated_at = now()
    WHERE archived_at IS NULL
      AND content_type IN (${sql.join(types, sql`, `)})
      AND brief_id IN (
        SELECT id FROM community_briefs
        WHERE habitat_id = ${habitatId} AND project_id = ${projectId}
      )
  `);
  // rowCount k m_pkg-specific; pg trả 'rowCount' top-level
  const rc = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  revalidatePath(`/p/${projectId}/tribes`);
  revalidatePath(`/p/${projectId}/seeding`);
  return { ok: true, archived: rc };
}

// Auto-restore: khi format bật lại, unarchive cards có reason khớp.
// Chỉ restore đúng những card archive bởi format-removed (không đụng
// cards archive vì lý do khác).
export async function restoreArchivedCardsByTypesForHabitat(
  projectId: string, habitatId: number, types: string[],
): Promise<{ ok: boolean; restored: number }> {
  if (types.length === 0) return { ok: true, restored: 0 };
  const db = ensureDb();
  const result = await db.execute(sql`
    UPDATE cards SET archived_at = NULL, archived_reason = NULL, updated_at = now()
    WHERE archived_at IS NOT NULL
      AND content_type IN (${sql.join(types, sql`, `)})
      AND archived_reason LIKE 'format-removed:%'
      AND brief_id IN (
        SELECT id FROM community_briefs
        WHERE habitat_id = ${habitatId} AND project_id = ${projectId}
      )
  `);
  const rc = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  revalidatePath(`/p/${projectId}/tribes`);
  revalidatePath(`/p/${projectId}/seeding`);
  return { ok: true, restored: rc };
}

// Variant cho platform-level: cùng logic nhưng phạm vi rộng hơn (mọi
// account dùng platform này → mọi habitat brief của chúng).
export async function countCardsByContentTypeForPlatform(
  platformKey: string,
): Promise<AffectedCardsByType[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT c.content_type AS ct, count(*)::int AS n
      FROM cards c
      JOIN community_briefs b ON b.id = c.brief_id
      JOIN platform_accounts pa ON pa.id = b.account_id
     WHERE pa.platform_key = ${platformKey} AND c.archived_at IS NULL
     GROUP BY c.content_type
     ORDER BY count(*) DESC
  `);
  return (rows as unknown as Array<{ ct: string; n: number }>)
    .map((r) => ({ contentType: String(r.ct ?? 'text'), count: Number(r.n) }));
}

export async function archiveCardsByTypesForPlatform(
  platformKey: string, types: string[],
): Promise<{ ok: boolean; archived: number }> {
  if (types.length === 0) return { ok: true, archived: 0 };
  const db = ensureDb();
  const result = await db.execute(sql`
    UPDATE cards SET archived_at = now(),
      archived_reason = 'format-removed:' || content_type,
      updated_at = now()
    WHERE archived_at IS NULL
      AND content_type IN (${sql.join(types, sql`, `)})
      AND brief_id IN (
        SELECT b.id FROM community_briefs b
        JOIN platform_accounts pa ON pa.id = b.account_id
        WHERE pa.platform_key = ${platformKey}
      )
  `);
  const rc = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  revalidatePath('/platforms');
  return { ok: true, archived: rc };
}

export async function restoreArchivedCardsByTypesForPlatform(
  platformKey: string, types: string[],
): Promise<{ ok: boolean; restored: number }> {
  if (types.length === 0) return { ok: true, restored: 0 };
  const db = ensureDb();
  const result = await db.execute(sql`
    UPDATE cards SET archived_at = NULL, archived_reason = NULL, updated_at = now()
    WHERE archived_at IS NOT NULL
      AND content_type IN (${sql.join(types, sql`, `)})
      AND archived_reason LIKE 'format-removed:%'
      AND brief_id IN (
        SELECT b.id FROM community_briefs b
        JOIN platform_accounts pa ON pa.id = b.account_id
        WHERE pa.platform_key = ${platformKey}
      )
  `);
  const rc = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  revalidatePath('/platforms');
  return { ok: true, restored: rc };
}
