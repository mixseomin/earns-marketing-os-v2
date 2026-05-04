'use server';

// Platform catalog CRUD — used by accounts-vault PlatformPicker.
// Existing schema: platforms { key (PK), label, signup_url, post_url, priority, fallback_keys, icon_slug, image_specs }

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { getDb, platforms } from '@mos2/db';

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

export async function createPlatform(input: PlatformInput): Promise<{ ok: boolean; key?: string; error?: string }> {
  const key = input.key?.trim() || slugify(input.label);
  if (!key) return { ok: false, error: 'key/label rỗng' };
  if (!input.label?.trim()) return { ok: false, error: 'label rỗng' };
  if (!input.signupUrl?.trim()) return { ok: false, error: 'signup URL rỗng' };
  const db = ensureDb();
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
      tags: input.tags ?? [],
      userCountEstimate: input.userCountEstimate ?? null,
      notes: input.notes ?? null,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true, key };
}

export async function updatePlatform(key: string, patch: Partial<PlatformInput>): Promise<{ ok: boolean; error?: string }> {
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
  if (Object.keys(set).length === 0) return { ok: true };
  try {
    await db.update(platforms).set(set).where(eq(platforms.key, key));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath('/p/[id]/resources', 'page');
  return { ok: true };
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
}

export async function listPlatformsWithUsage(): Promise<PlatformWithUsage[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT p.key, p.label, p.signup_url, p.post_url, p.profile_url_pattern, p.priority, p.icon_slug, p.fallback_keys,
           p.description, p.pricing, p.region, p.category, p.tags, p.user_count_estimate, p.notes,
           (SELECT COUNT(*)::int FROM platform_accounts WHERE platform_key = p.key) AS accounts_count
    FROM platforms p
    ORDER BY p.label
  `);
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
  }));
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
