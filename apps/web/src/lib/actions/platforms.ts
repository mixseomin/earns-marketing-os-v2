'use server';

// Platform catalog CRUD — used by accounts-vault PlatformPicker.
// Existing schema: platforms { key (PK), label, signup_url, post_url, priority, fallback_keys, icon_slug, image_specs }

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { getDb, platforms } from '@mos2/db';
import type { SignupField } from './technologies';
import {
  fetchDirectusPlatformCatalog, directusEnabled,
  findDirectusPlatformBySlug, createDirectusPlatform, updateDirectusPlatform,
} from '../bridge/directus';

// MOS2 category → Directus type. Directus has a smaller enum
// (api / marketplace / messaging / platform / tool); map MOS2's broader
// categories down to closest Directus value.
const CATEGORY_TO_DIRECTUS_TYPE: Record<string, string> = {
  marketplace: 'marketplace',
  messaging: 'messaging',
  community: 'platform',
  social: 'platform',
  video: 'platform',
  blog: 'platform',
  launch: 'platform',
  newsletter: 'platform',
  design: 'tool',
  audio: 'platform',
  other: 'platform',
};

// Push a MOS2 platform record to Directus. Idempotent: dedupes by slug —
// if Directus already has the slug, PATCH; otherwise POST. Soft-fails so
// MOS2 mutations never block on Directus availability.
async function pushPlatformToDirectus(input: {
  key: string; label: string; signupUrl: string;
  category?: PlatformCategory; description?: string;
}): Promise<{ directusId: string | null; created: boolean; error?: string }> {
  if (!directusEnabled()) return { directusId: null, created: false };
  try {
    const existing = await findDirectusPlatformBySlug(input.key);
    const payload = {
      name: input.label,
      slug: input.key,
      type: CATEGORY_TO_DIRECTUS_TYPE[input.category ?? 'other'] ?? 'platform',
      url: input.signupUrl || null,
      notes: input.description || null,
      status: 'active',
    };
    if (existing) {
      await updateDirectusPlatform(existing.id, payload);
      return { directusId: existing.id, created: false };
    }
    const created = await createDirectusPlatform(payload);
    return { directusId: created.id, created: true };
  } catch (e) {
    return { directusId: null, created: false, error: (e as Error).message };
  }
}

export type PlatformPriority = 'critical' | 'high' | 'medium' | 'low';
export type PlatformCategory =
  | 'community' | 'social' | 'video' | 'blog' | 'launch' | 'marketplace'
  | 'messaging' | 'newsletter' | 'design' | 'audio' | 'other';

export interface PlatformInput {
  key: string;
  label: string;
  signupUrl: string;
  postUrl?: string | null;
  profileUrlPattern?: string | null;
  priority: PlatformPriority;
  iconSlug: string;
  fallbackKeys?: string[];
  description?: string;
  pricing?: string | null;
  region?: string | null;
  category?: PlatformCategory;
  tags?: string[];
  userCountEstimate?: string | null;
  notes?: string | null;
  technologyKey?: string | null;
  signupFields?: SignupField[];
  // Override content formats hardcoded (content-formats.ts PROFILE_BY_KEY).
  // null/undefined = không thay đổi DB; pass [] để clear xuống fallback hardcoded.
  allowedFormats?: string[] | null;
  formatMix?: Record<string, number> | null;
}

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32);
}

// Pull canonical platforms catalog from Directus `platforms` collection
// (155+ rows with proper structure: name, slug, type, url, notes, etc).
// Idempotent — existing keys are LEFT ALONE (no overwrite of admin edits).
// New keys carry tag 'directus-sync' so admin can find/refine them later.
//
// Directus type → MOS2 category mapping:
//   marketplace → marketplace, messaging → messaging, api → other,
//   tool → other, platform → other (generic), default → other
const TYPE_TO_CATEGORY: Record<string, PlatformCategory> = {
  marketplace: 'marketplace',
  messaging: 'messaging',
  api: 'other',
  tool: 'other',
  platform: 'other',
};

export async function syncPlatformsFromDirectus(): Promise<{
  ok: boolean; created: number; alreadyExisted: number; error?: string;
}> {
  if (!directusEnabled()) return { ok: false, created: 0, alreadyExisted: 0, error: 'Directus bridge disabled' };
  const db = ensureDb();
  let catalog;
  try {
    catalog = await fetchDirectusPlatformCatalog();
  } catch (e) {
    return { ok: false, created: 0, alreadyExisted: 0, error: (e as Error).message };
  }

  // Existing keys
  const existing = await db.select({ key: platforms.key }).from(platforms);
  const existingSet = new Set(existing.map((r) => r.key));

  let alreadyExisted = 0;
  const toInsert: Array<typeof platforms.$inferInsert> = [];
  for (const it of catalog) {
    // Use Directus slug if valid, else slugify name. Lowercase for MOS2.
    const key = (it.slug || slugify(it.name)).toLowerCase();
    if (!key) continue;
    if (existingSet.has(key)) { alreadyExisted += 1; continue; }
    toInsert.push({
      key,
      label: it.name,
      signupUrl: it.url ?? '',
      postUrl: null,
      profileUrlPattern: null,
      priority: 'low',
      iconSlug: key,
      fallbackKeys: [],
      imageSpecs: [],
      description: it.notes ?? `Imported from Directus platforms catalog (${it.accountsCount} account${it.accountsCount === 1 ? '' : 's'}).`,
      pricing: null,
      region: null,
      category: TYPE_TO_CATEGORY[it.type.toLowerCase()] ?? 'other',
      tags: ['directus-sync', `directus-id:${it.id}`, ...(it.type ? [`type:${it.type}`] : [])],
      userCountEstimate: null,
      notes: null,
    });
  }
  let created = 0;
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 50) {
      const chunk = toInsert.slice(i, i + 50);
      await db.insert(platforms).values(chunk).onConflictDoNothing();
      created += chunk.length;
    }
  }
  revalidatePath('/platforms');
  return { ok: true, created, alreadyExisted };
}

export async function createPlatform(input: PlatformInput): Promise<{ ok: boolean; key?: string; error?: string; directusWarning?: string }> {
  const key = input.key?.trim() || slugify(input.label);
  if (!key) return { ok: false, error: 'key/label rỗng' };
  if (!input.label?.trim()) return { ok: false, error: 'label rỗng' };
  if (!input.signupUrl?.trim()) return { ok: false, error: 'signup URL rỗng' };
  const db = ensureDb();
  // Auto-push to Directus first so we can stamp the directus-id tag at insert time.
  // Directus is treated as source of truth; if it dedupes a slug we use its row.
  const push = await pushPlatformToDirectus({
    key, label: input.label.trim(),
    signupUrl: input.signupUrl.trim(),
    category: input.category,
    description: input.description,
  });
  const baseTags = input.tags ?? [];
  const directusTag = push.directusId ? [`directus-id:${push.directusId}`] : [];
  try {
    await db.insert(platforms).values({
      key, label: input.label.trim(),
      signupUrl: input.signupUrl.trim(),
      postUrl: input.postUrl ?? null,
      profileUrlPattern: input.profileUrlPattern ?? null,
      priority: input.priority,
      iconSlug: input.iconSlug || key,
      fallbackKeys: input.fallbackKeys ?? [],
      imageSpecs: [],
      description: input.description ?? '',
      pricing: input.pricing ?? null,
      region: input.region ?? null,
      category: input.category ?? 'other',
      tags: [...baseTags, ...directusTag],
      userCountEstimate: input.userCountEstimate ?? null,
      notes: input.notes ?? null,
      technologyKey: input.technologyKey ?? null,
      signupFields: input.signupFields ?? [],
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath('/p/[id]/resources', 'page');
  revalidatePath('/platforms');
  return {
    ok: true, key,
    directusWarning: push.error ? `Saved to MOS2 but Directus push failed: ${push.error}` : undefined,
  };
}

export async function updatePlatform(key: string, patch: Partial<PlatformInput>): Promise<{ ok: boolean; error?: string; directusWarning?: string }> {
  const db = ensureDb();
  const set: Partial<typeof platforms.$inferInsert> = {};
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.signupUrl !== undefined) set.signupUrl = patch.signupUrl;
  if (patch.postUrl !== undefined) set.postUrl = patch.postUrl;
  if (patch.profileUrlPattern !== undefined) set.profileUrlPattern = patch.profileUrlPattern;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.iconSlug !== undefined) set.iconSlug = patch.iconSlug;
  if (patch.fallbackKeys !== undefined) set.fallbackKeys = patch.fallbackKeys;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.pricing !== undefined) set.pricing = patch.pricing;
  if (patch.region !== undefined) set.region = patch.region;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.tags !== undefined) set.tags = patch.tags;
  if (patch.userCountEstimate !== undefined) set.userCountEstimate = patch.userCountEstimate;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.technologyKey !== undefined) set.technologyKey = patch.technologyKey;
  if (patch.signupFields !== undefined) set.signupFields = patch.signupFields;
  if (patch.allowedFormats !== undefined) set.allowedFormats = patch.allowedFormats;
  if (patch.formatMix !== undefined) set.formatMix = patch.formatMix;
  if (Object.keys(set).length === 0) return { ok: true };
  // allowed_formats: auto-restore archived cards của types được tick lại
  // (cùng pattern updateHabitat). Archive cho types removed: client gọi
  // archiveCardsByTypesForPlatform sau confirm dialog.
  let restoredTypes: string[] = [];
  if (patch.allowedFormats !== undefined) {
    const [prev] = await db.select({ af: platforms.allowedFormats }).from(platforms).where(eq(platforms.key, key)).limit(1);
    const prevList = prev?.af;
    if (Array.isArray(patch.allowedFormats) && Array.isArray(prevList)) {
      const prevSet = new Set(prevList as string[]);
      const newSet = new Set(patch.allowedFormats as string[]);
      restoredTypes = [...newSet].filter((t) => !prevSet.has(t));
    }
  }
  try {
    await db.update(platforms).set(set).where(eq(platforms.key, key));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (restoredTypes.length > 0) {
    await db.execute(sql`
      UPDATE cards SET archived_at = NULL, archived_reason = NULL, updated_at = now()
      WHERE archived_at IS NOT NULL
        AND content_type IN (${sql.join(restoredTypes, sql`, `)})
        AND archived_reason LIKE 'format-removed:%'
        AND brief_id IN (
          SELECT b.id FROM community_briefs b
          JOIN platform_accounts pa ON pa.id = b.account_id
          WHERE pa.platform_key = ${key}
        )
    `);
  }

  // Auto-sync to Directus — Directus = source of truth, so any MOS2 edit
  // propagates. dedupe by slug ensures we PATCH existing rather than create
  // duplicate. Tag MOS2 row with directus-id if newly linked.
  let directusWarning: string | undefined;
  if (directusEnabled()) {
    const [current] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.key, key))
      .limit(1);
    if (current) {
      const push = await pushPlatformToDirectus({
        key: current.key,
        label: current.label,
        signupUrl: current.signupUrl,
        category: current.category as PlatformCategory,
        description: current.description,
      });
      if (push.error) {
        directusWarning = `MOS2 saved but Directus sync failed: ${push.error}`;
      } else if (push.directusId) {
        // Stamp directus-id tag if not already present
        const tags = (current.tags as string[]) ?? [];
        const hasIdTag = tags.some((t) => t.startsWith('directus-id:'));
        if (!hasIdTag) {
          await db.update(platforms)
            .set({ tags: [...tags, `directus-id:${push.directusId}`] })
            .where(eq(platforms.key, key));
        }
      }
    }
  }

  revalidatePath('/p/[id]/resources', 'page');
  revalidatePath('/platforms');
  return { ok: true, directusWarning };
}

export interface PlatformWithUsage {
  key: string;
  label: string;
  signupUrl: string;
  postUrl: string | null;
  profileUrlPattern: string | null;
  priority: PlatformPriority;
  iconSlug: string;
  fallbackKeys: string[];
  description: string;
  pricing: string | null;
  region: string | null;
  category: PlatformCategory;
  tags: string[];
  userCountEstimate: string | null;
  notes: string | null;
  accountsCount: number;
  technologyKey: string | null;
  signupFields: SignupField[];
  allowedFormats: string[] | null;
  formatMix: Record<string, number> | null;
  /** Platform-scope selectors của riêng nền tảng này, theo page_kind. */
  selectorCounts: Record<string, number>;
  /** Selectors KẾ THỪA từ technology pack (nếu technologyKey set), theo page_kind. */
  inheritedCounts: Record<string, number>;
}

export async function listPlatformsWithUsage(): Promise<PlatformWithUsage[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT p.key, p.label, p.signup_url, p.post_url, p.profile_url_pattern, p.priority, p.icon_slug, p.fallback_keys,
           p.description, p.pricing, p.region, p.category, p.tags, p.user_count_estimate, p.notes,
           p.technology_key, p.signup_fields, p.allowed_formats, p.format_mix,
           (SELECT COUNT(*)::int FROM platform_accounts WHERE platform_key = p.key) AS accounts_count
    FROM platforms p
    ORDER BY p.label
  `);
  // Selector coverage theo page_kind: platform-scope (riêng nền tảng) + technology-scope
  // (kế thừa). 1 query gộp → 2 map. Cascade lúc chạy: platform đè technology.
  const selRows = await db.execute(sql`
    SELECT scope_kind, scope_key, page_kind, count(*)::int AS n
    FROM selector_overrides
    WHERE scope_kind IN ('platform', 'technology', 'engine')
    GROUP BY scope_kind, scope_key, page_kind
  `);
  const ownByPlat = new Map<string, Record<string, number>>();
  const byTech = new Map<string, Record<string, number>>();
  for (const s of selRows as unknown as Array<{ scope_kind: string; scope_key: string; page_kind: string; n: number }>) {
    const target = s.scope_kind === 'platform' ? ownByPlat : byTech;
    const m = target.get(s.scope_key) ?? target.set(s.scope_key, {}).get(s.scope_key)!;
    m[s.page_kind] = (m[s.page_kind] ?? 0) + Number(s.n);
  }
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    key: String(r.key),
    label: String(r.label),
    signupUrl: String(r.signup_url),
    postUrl: (r.post_url as string | null) ?? null,
    profileUrlPattern: (r.profile_url_pattern as string | null) ?? null,
    priority: String(r.priority) as PlatformPriority,
    iconSlug: String(r.icon_slug),
    fallbackKeys: Array.isArray(r.fallback_keys) ? (r.fallback_keys as string[]) : [],
    description: String(r.description ?? ''),
    pricing: (r.pricing as string | null) ?? null,
    region: (r.region as string | null) ?? null,
    category: String(r.category ?? 'other') as PlatformCategory,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    userCountEstimate: (r.user_count_estimate as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    accountsCount: Number(r.accounts_count) || 0,
    technologyKey: (r.technology_key as string | null) ?? null,
    signupFields: Array.isArray(r.signup_fields) ? (r.signup_fields as SignupField[]) : [],
    allowedFormats: Array.isArray(r.allowed_formats) ? (r.allowed_formats as string[]) : null,
    formatMix: (r.format_mix && typeof r.format_mix === 'object' && !Array.isArray(r.format_mix))
      ? (r.format_mix as Record<string, number>) : null,
    selectorCounts: ownByPlat.get(String(r.key)) ?? {},
    inheritedCounts: r.technology_key ? (byTech.get(String(r.technology_key)) ?? {}) : {},
  }));
}

// Template Adoption: bind a platform to a technology so it inherits the
// technology-scope selector pack (1 template → N forums). Upserts a stub platform
// row when the key doesn't exist yet (brand-new forum discovered by the ext),
// then sets technology_key. Clears the matching detection (adopted = handled).
// technologyKey=null unbinds. Explicit human action — never auto-bound.
export async function adoptTemplate(input: {
  platformKey: string; technologyKey: string | null; label?: string; signupUrl?: string;
}): Promise<{ ok: boolean; created?: boolean; error?: string }> {
  const db = ensureDb();
  const key = input.platformKey.trim();
  if (!key) return { ok: false, error: 'platformKey required' };
  try {
    const res = await db.execute(sql`
      INSERT INTO platforms (key, label, signup_url, technology_key)
      VALUES (${key}, ${input.label || key}, ${input.signupUrl || ''}, ${input.technologyKey})
      ON CONFLICT (key) DO UPDATE SET technology_key = ${input.technologyKey}, updated_at = now()
      RETURNING (xmax = 0) AS inserted`);
    const created = !!(res as unknown as Array<{ inserted: boolean }>)[0]?.inserted;
    if (input.technologyKey) {
      // drop the detection(s) for this platform that match the adopted tech
      await db.execute(sql`DELETE FROM platform_tech_detections WHERE platform_key = ${key} AND technology_key = ${input.technologyKey}`);
    }
    revalidatePath('/architecture');
    revalidatePath('/platforms');
    return { ok: true, created };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Toggle archived tag on a platform. Archived platforms are hidden from the
// picker by default — still exist in DB, can be restored.
export async function archivePlatform(key: string, archive: boolean): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const [row] = await db.select({ tags: platforms.tags }).from(platforms).where(eq(platforms.key, key)).limit(1);
  if (!row) return { ok: false, error: 'Platform not found' };
  const tags = ((row.tags as string[]) ?? []).filter((t) => t !== 'archived');
  if (archive) tags.push('archived');
  await db.update(platforms).set({ tags, updatedAt: new Date() }).where(eq(platforms.key, key));
  revalidatePath('/p/[id]/resources', 'page');
  revalidatePath('/platforms', 'page');
  return { ok: true };
}

export async function deletePlatform(key: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  // Block delete if referenced
  const ref = await db.execute(sql`SELECT COUNT(*)::int AS n FROM platform_accounts WHERE platform_key = ${key}`);
  const n = (ref as unknown as Array<{ n: number }>)[0]?.n ?? 0;
  if (n > 0) return { ok: false, error: `Có ${n} accounts đang dùng platform này — xóa account trước.` };
  await db.delete(platforms).where(eq(platforms.key, key));
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true };
}
