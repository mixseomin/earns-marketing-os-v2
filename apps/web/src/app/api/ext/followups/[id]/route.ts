import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../../_auth';
import { errorResponse, okResponse, firstRow } from '@/lib/ext-route';
import { touchEntity } from '@/lib/touch-entity';
import { FOLLOWUP_STATUS } from '../route';

export const dynamic = 'force-dynamic';

// POST /api/ext/followups/[id]  { status?, due?, note?, title? }  — any subset.
//   status → chờ/đang/xong/kẹt/bỏ · due ('' clears) · note appends one dated line to the progress log
//   · title retitles. Marking done stamps completed_at; leaving done clears it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('no db', 503);
  const taskId = Number((await params).id);
  if (!Number.isFinite(taskId)) return errorResponse('bad id', 400);
  const b = (await req.json().catch(() => ({}))) as { status?: string; due?: string; note?: string; title?: string };

  const cur = await db.execute(sql`SELECT project_id FROM human_tasks WHERE id = ${taskId} AND platform_key = 'followup' LIMIT 1`);
  const t = firstRow<{ project_id: string }>(cur);
  if (!t) return errorResponse('not a follow-up', 404);

  const sets = [sql`updated_at = now()`];
  if (b.status !== undefined) {
    const status = String(b.status).trim();
    if (!FOLLOWUP_STATUS.includes(status as (typeof FOLLOWUP_STATUS)[number])) return errorResponse(`status ∈ ${FOLLOWUP_STATUS.join('|')}`, 400);
    sets.push(sql`status = ${status}`);
    sets.push(status === 'done' ? sql`completed_at = now()` : sql`completed_at = NULL`);
  }
  if (b.due !== undefined) {
    const due = String(b.due).trim();
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return errorResponse('due must be YYYY-MM-DD or empty', 400);
    sets.push(due ? sql`sla_due_at = ${due}::date` : sql`sla_due_at = NULL`);
  }
  if (b.title !== undefined) {
    const title = String(b.title).trim();
    if (!title) return errorResponse('title cannot be empty', 400);
    sets.push(sql`title = ${title}`);
  }
  if (b.note !== undefined) {
    const note = String(b.note).trim();
    if (note) sets.push(sql`notes = btrim(coalesce(notes, '') || E'\n' || to_char(now(), 'YYYY-MM-DD') || ' ' || ${note})`);
  }
  if (sets.length === 1) return errorResponse('nothing to update (status|due|note|title)', 400);

  await db.execute(sql`UPDATE human_tasks SET ${sql.join(sets, sql`, `)} WHERE id = ${taskId} AND platform_key = 'followup'`);
  await touchEntity('followup', { projectId: String(t.project_id) });
  return okResponse({ id: taskId });
}

// DELETE /api/ext/followups/[id] — hard-remove a mis-filed follow-up.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('no db', 503);
  const taskId = Number((await params).id);
  if (!Number.isFinite(taskId)) return errorResponse('bad id', 400);
  const r = await db.execute(sql`DELETE FROM human_tasks WHERE id = ${taskId} AND platform_key = 'followup' RETURNING project_id`);
  const row = firstRow<{ project_id: string }>(r);
  if (!row) return errorResponse('not a follow-up', 404);
  await touchEntity('followup', { projectId: String(row.project_id) });
  return okResponse({ id: taskId, deleted: true });
}
