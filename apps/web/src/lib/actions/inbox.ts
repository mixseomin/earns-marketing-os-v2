'use server';

// Phase 11 Human Inbox actions: list / claim / complete / cancel human_tasks.

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export interface HumanTaskRow {
  id: number;
  projectId: string | null;
  projectName: string | null;
  cardId: number | null;
  parentRunId: number | null;
  title: string;
  instructions: string;
  prepPayload: Record<string, unknown>;
  platformKey: string | null;
  accountId: number | null;
  slaDueAt: string | null;
  status: string;
  claimedBy: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  publishUrl: string | null;
  screenshotUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export async function listInbox(filterStatus: string = 'all'): Promise<HumanTaskRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT ht.id, ht.project_id, p.name AS project_name, ht.card_id, ht.parent_run_id,
           ht.title, ht.instructions, ht.prep_payload, ht.platform_key, ht.account_id,
           ht.sla_due_at, ht.status, ht.claimed_by, ht.claimed_at, ht.completed_at,
           ht.verified_at, ht.publish_url, ht.screenshot_url, ht.notes, ht.created_at
    FROM human_tasks ht
    LEFT JOIN projects p ON p.id = ht.project_id
    WHERE ht.tenant_id = ${TENANT}
      ${filterStatus !== 'all' ? sql`AND ht.status = ${filterStatus}` : sql``}
    ORDER BY
      CASE ht.status
        WHEN 'pending' THEN 1
        WHEN 'claimed' THEN 2
        WHEN 'in_progress' THEN 3
        WHEN 'completed' THEN 4
        WHEN 'verified' THEN 5
        ELSE 6
      END,
      ht.sla_due_at ASC NULLS LAST,
      ht.created_at DESC
    LIMIT 100
  `);
  const toIso = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return new Date(v).toISOString();
    return null;
  };
  return (rows as unknown as Array<{
    id: number | string; project_id: string | null; project_name: string | null;
    card_id: number | null; parent_run_id: number | null;
    title: string; instructions: string; prep_payload: Record<string, unknown>;
    platform_key: string | null; account_id: number | null;
    sla_due_at: unknown; status: string; claimed_by: string | null;
    claimed_at: unknown; completed_at: unknown; verified_at: unknown;
    publish_url: string | null; screenshot_url: string | null;
    notes: string | null; created_at: unknown;
  }>).map((r) => ({
    id: Number(r.id),
    projectId: r.project_id, projectName: r.project_name,
    cardId: r.card_id, parentRunId: r.parent_run_id,
    title: r.title, instructions: r.instructions,
    prepPayload: r.prep_payload ?? {},
    platformKey: r.platform_key, accountId: r.account_id,
    slaDueAt: toIso(r.sla_due_at), status: r.status,
    claimedBy: r.claimed_by, claimedAt: toIso(r.claimed_at),
    completedAt: toIso(r.completed_at), verifiedAt: toIso(r.verified_at),
    publishUrl: r.publish_url, screenshotUrl: r.screenshot_url,
    notes: r.notes,
    createdAt: toIso(r.created_at) ?? '',
  }));
}

export async function claimTask(taskId: number, userId: string = 'self'): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    UPDATE human_tasks SET status='claimed', claimed_by=${userId}, claimed_at=NOW(), updated_at=NOW()
    WHERE tenant_id = ${TENANT} AND id = ${taskId} AND status = 'pending'
  `);
  revalidatePath('/inbox');
  return { ok: true };
}

export async function completeTask(taskId: number, body: {
  publishUrl?: string;
  screenshotUrl?: string;
  notes?: string;
}): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    UPDATE human_tasks SET
      status = 'completed',
      publish_url = ${body.publishUrl ?? null},
      screenshot_url = ${body.screenshotUrl ?? null},
      notes = ${body.notes ?? null},
      completed_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = ${TENANT} AND id = ${taskId}
  `);
  revalidatePath('/inbox');
  return { ok: true };
}

export async function cancelTask(taskId: number, reason?: string): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    UPDATE human_tasks SET status='cancelled', notes=${reason ?? null}, updated_at=NOW()
    WHERE tenant_id = ${TENANT} AND id = ${taskId}
  `);
  revalidatePath('/inbox');
  return { ok: true };
}

export async function unclaimTask(taskId: number): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    UPDATE human_tasks SET status='pending', claimed_by=NULL, claimed_at=NULL, updated_at=NOW()
    WHERE tenant_id = ${TENANT} AND id = ${taskId}
  `);
  revalidatePath('/inbox');
  return { ok: true };
}
