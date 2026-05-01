'use server';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@mos2/db';
import { detectPlatform, PLATFORM_CONFIGS } from '@/lib/publications/types';
import type { Publication, PublicationActivity } from '@/lib/publications/types';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

const toIso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return new Date(v).toISOString();
  return null;
};

export async function listPublications(projectId: string): Promise<Publication[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT id, project_id, url, title, platform_key, account_id, published_at,
           last_checked_at, last_activity_at, check_interval_hours, next_check_at,
           reply_count, view_count, score, status, metadata, created_at
    FROM publications
    WHERE tenant_id = ${TENANT} AND project_id = ${projectId}
    ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
    LIMIT 200
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r['id']),
    projectId: String(r['project_id']),
    url: String(r['url']),
    title: r['title'] as string | null,
    platformKey: String(r['platform_key']),
    accountId: r['account_id'] != null ? Number(r['account_id']) : null,
    publishedAt: toIso(r['published_at']),
    lastCheckedAt: toIso(r['last_checked_at']),
    lastActivityAt: toIso(r['last_activity_at']),
    checkIntervalHours: Number(r['check_interval_hours']),
    nextCheckAt: toIso(r['next_check_at']),
    replyCount: Number(r['reply_count'] ?? 0),
    viewCount: r['view_count'] != null ? Number(r['view_count']) : null,
    score: r['score'] != null ? Number(r['score']) : null,
    status: String(r['status']),
    metadata: (r['metadata'] as Record<string, unknown>) ?? {},
    createdAt: toIso(r['created_at']) ?? '',
  }));
}

export async function addPublication(data: {
  projectId: string;
  url: string;
  platformKey?: string;
  title?: string;
  publishedAt?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  const platform = data.platformKey ?? detectPlatform(data.url);
  const intervalHours = PLATFORM_CONFIGS[platform]?.defaultIntervalHours ?? 6;
  try {
    const rows = await db.execute(sql`
      INSERT INTO publications (tenant_id, project_id, url, title, platform_key, published_at, check_interval_hours, next_check_at, status)
      VALUES (
        'self', ${data.projectId}, ${data.url}, ${data.title ?? null}, ${platform},
        ${data.publishedAt ?? null}::timestamptz,
        ${intervalHours},
        NOW(),
        'active'
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    const id = (rows as unknown as Array<{ id: number }>)[0]?.id;
    revalidatePath(`/p/${data.projectId}/publications`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function updatePublicationStatus(id: number, status: string): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`UPDATE publications SET status = ${status}, updated_at = NOW() WHERE tenant_id = ${TENANT} AND id = ${id}`);
  revalidatePath('/p');
  return { ok: true };
}

export async function updatePublicationInterval(id: number, hours: number): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`UPDATE publications SET check_interval_hours = ${hours}, next_check_at = NOW(), updated_at = NOW() WHERE tenant_id = ${TENANT} AND id = ${id}`);
  return { ok: true };
}

export async function getPublicationActivities(publicationId: number, limit = 30): Promise<PublicationActivity[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT id, publication_id, detected_at, activity_type, external_id,
           author, content_snippet, activity_url, human_task_id, created_at
    FROM publication_activities
    WHERE publication_id = ${publicationId}
    ORDER BY detected_at DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r['id']),
    publicationId: Number(r['publication_id']),
    detectedAt: toIso(r['detected_at']) ?? '',
    activityType: String(r['activity_type']),
    externalId: r['external_id'] as string | null,
    author: r['author'] as string | null,
    contentSnippet: r['content_snippet'] as string | null,
    activityUrl: r['activity_url'] as string | null,
    humanTaskId: r['human_task_id'] != null ? Number(r['human_task_id']) : null,
    createdAt: toIso(r['created_at']) ?? '',
  }));
}
