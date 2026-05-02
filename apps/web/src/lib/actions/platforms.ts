'use server';

// Platform catalog CRUD — used by accounts-vault PlatformPicker.
// Existing schema: platforms { key (PK), label, signup_url, post_url, priority, fallback_keys, icon_slug, image_specs }

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { getDb, platforms } from '@mos2/db';

export type PlatformPriority = 'critical' | 'high' | 'medium' | 'low';

export interface PlatformInput {
  key: string;
  label: string;
  signupUrl: string;
  postUrl?: string | null;
  priority: PlatformPriority;
  iconSlug: string;
  fallbackKeys?: string[];
  category?: string | null;        // optional grouping (community/social/blog/...)
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
      priority: input.priority,
      iconSlug: input.iconSlug || key,
      fallbackKeys: input.fallbackKeys ?? [],
      imageSpecs: [],
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
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.iconSlug !== undefined) set.iconSlug = patch.iconSlug;
  if (patch.fallbackKeys !== undefined) set.fallbackKeys = patch.fallbackKeys;
  if (Object.keys(set).length === 0) return { ok: true };
  try {
    await db.update(platforms).set(set).where(eq(platforms.key, key));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath('/p/[id]/resources', 'page');
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
