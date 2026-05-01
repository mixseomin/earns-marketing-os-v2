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
  feedbackType: string | null;
  feedbackText: string | null;
  createdAt: string;
}

export async function listInbox(filterStatus: string = 'all'): Promise<HumanTaskRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT ht.id, ht.project_id, p.name AS project_name, ht.card_id, ht.parent_run_id,
           ht.title, ht.instructions, ht.prep_payload, ht.platform_key, ht.account_id,
           ht.sla_due_at, ht.status, ht.claimed_by, ht.claimed_at, ht.completed_at,
           ht.verified_at, ht.publish_url, ht.screenshot_url, ht.notes,
           ht.feedback_type, ht.feedback_text, ht.created_at
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
    notes: string | null; feedback_type: string | null; feedback_text: string | null;
    created_at: unknown;
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
    feedbackType: r.feedback_type, feedbackText: r.feedback_text,
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

export type FeedbackType = 'success' | 'revise' | 'error' | 'more-info';

export async function completeTask(taskId: number, body: {
  publishUrl?: string;
  screenshotUrl?: string;
  notes?: string;
  feedbackType?: FeedbackType;
  feedbackText?: string;
}): Promise<{ ok: boolean; spawnedCardId?: number }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    UPDATE human_tasks SET
      status = 'completed',
      publish_url = ${body.publishUrl ?? null},
      screenshot_url = ${body.screenshotUrl ?? null},
      notes = ${body.notes ?? null},
      feedback_type = ${body.feedbackType ?? null},
      feedback_text = ${body.feedbackText ?? null},
      completed_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = ${TENANT} AND id = ${taskId}
  `);

  // Feedback loop: nếu user yêu cầu revise → spawn writer card mới với feedback.
  let spawnedCardId: number | undefined;
  if (body.feedbackType === 'revise' || body.feedbackType === 'more-info') {
    // Lookup task để có parent_run + workflow context.
    const taskRows = await db.execute(sql`
      SELECT ht.parent_run_id, ar.card_id, c.workflow_run_id, c.workflow_key, c.workflow_context, c.project_id, c.col, c.squad_key, c.title
      FROM human_tasks ht
      LEFT JOIN agent_runs ar ON ar.id = ht.parent_run_id
      LEFT JOIN cards c ON c.id = ar.card_id
      WHERE ht.id = ${taskId} LIMIT 1
    `);
    const t = (taskRows as unknown as Array<{
      parent_run_id: number | null; card_id: number | null;
      workflow_run_id: string | null; workflow_key: string | null;
      workflow_context: Record<string, unknown> | null;
      project_id: string | null; col: string | null;
      squad_key: string | null; title: string | null;
    }>)[0];
    if (t?.workflow_run_id && t?.workflow_key === 'reddit-launch') {
      // Re-spawn writer step với feedback prepended.
      const ctx: Record<string, unknown> = { ...(t.workflow_context ?? {}), feedback: body.feedbackText ?? '' };
      const newRef = `RV-${Math.floor(1000 + Math.random() * 9000)}`;
      const reviseBody = `## Feedback từ human (revise request)
${body.feedbackText ?? '(no detail)'}

## Plan gốc
${(ctx.plan as string) ?? '(empty)'}

## Yêu cầu
Revise Reddit post dựa trên feedback. Output title + body markdown như step write trước. BẮT BUỘC gọi save-knowledge với title='Reddit post revised' + content=full title+body.`;
      const insRows = await db.execute(sql`
        INSERT INTO cards (
          tenant_id, project_id, card_ref, col, title, body,
          squad_key, level, due, agent_kind, dispatch_ready, idempotency_key,
          workflow_run_id, workflow_key, workflow_step, workflow_context, tags
        ) VALUES (
          'self', ${t.project_id ?? 'orit'}, ${newRef}, ${t.col ?? 'prospecting'},
          ${`✍️ Revise — ${t.title ?? 'Reddit post'}`}, ${reviseBody},
          'wf-writer', 2, 'NOW',
          'gpt-4o-mini', true,
          ${`${t.workflow_run_id}-revise-${Date.now()}`},
          ${t.workflow_run_id}, 'reddit-launch', 'write',
          ${JSON.stringify(ctx)}::jsonb,
          ${JSON.stringify(['workflow:reddit-launch', 'step:write', 'revise'])}::jsonb
        ) RETURNING id
      `);
      const r = (insRows as unknown as Array<{ id: number | string }>)[0];
      if (r) spawnedCardId = Number(r.id);
    }
  }

  revalidatePath('/inbox');
  return { ok: true, spawnedCardId };
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
