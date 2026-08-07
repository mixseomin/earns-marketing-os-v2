import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../_auth';
import { errorResponse, okResponse, rows } from '@/lib/ext-route';
import { touchEntity } from '@/lib/touch-entity';

export const dynamic = 'force-dynamic';

// Follow-ups = deferred/next-step work items, stored as human_tasks with platform_key='followup'
// (a distinct kind so the backlinks view + workers ignore them). Reuse existing columns — no migration:
//   project_id = slug · title = task · instructions = context-to-resume · notes = progress log
//   status ∈ FOLLOWUP_STATUS · sla_due_at = the 🗓 come-back date. They render on the plays calendar.
export const FOLLOWUP_STATUS = ['pending', 'doing', 'done', 'blocked', 'dropped'] as const;
type FStatus = (typeof FOLLOWUP_STATUS)[number];

// GET /api/ext/followups?project=<slug>&due=1
//   list follow-ups (id · project · status · due · title). due=1 → only those due today-or-earlier
//   and still open (not done/dropped) — this is what /now pulls to resume a thread weeks later.
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('no db', 503);
  const u = new URL(req.url);
  const project = (u.searchParams.get('project') ?? '').trim();
  const dueOnly = u.searchParams.get('due') === '1';

  const conds = [sql`platform_key = 'followup'`];
  if (project) conds.push(sql`project_id = ${project}`);
  if (dueOnly) conds.push(sql`status NOT IN ('done','dropped') AND sla_due_at IS NOT NULL AND sla_due_at::date <= now()::date`);
  const r = await db.execute(sql`
    SELECT id, project_id, title, status,
           to_char(sla_due_at, 'YYYY-MM-DD') AS due, instructions, notes,
           to_char(updated_at, 'YYYY-MM-DD') AS updated
    FROM human_tasks
    WHERE ${sql.join(conds, sql` AND `)}
    ORDER BY (status IN ('done','dropped')), sla_due_at NULLS LAST, id`);
  return okResponse({ items: rows(r) });
}

// POST /api/ext/followups  { projectId, title, detail?, due?, status? }
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('no db', 503);
  const b = (await req.json().catch(() => ({}))) as { projectId?: string; title?: string; detail?: string; due?: string; status?: string };

  const projectId = String(b.projectId ?? '').trim();
  const title = String(b.title ?? '').trim();
  if (!projectId || !title) return errorResponse('projectId, title required', 400);
  if (!/^[a-z0-9_-]+$/.test(projectId)) return errorResponse('projectId must be a slug [a-z0-9_-]', 400);
  const status = String(b.status ?? 'pending').trim();
  if (!FOLLOWUP_STATUS.includes(status as FStatus)) return errorResponse(`status ∈ ${FOLLOWUP_STATUS.join('|')}`, 400);
  const due = String(b.due ?? '').trim();
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return errorResponse('due must be YYYY-MM-DD', 400);
  const detail = String(b.detail ?? '').trim();

  const ins = await db.execute(sql`
    INSERT INTO human_tasks (tenant_id, project_id, title, instructions, prep_payload, platform_key, status, sla_due_at, completed_at)
    VALUES ('self', ${projectId}, ${title}, ${detail}, '{}'::jsonb, 'followup', ${status},
            ${due ? sql`${due}::date` : sql`NULL`}, ${status === 'done' ? sql`now()` : sql`NULL`})
    RETURNING id`);
  const id = Number(rows<{ id: number }>(ins)[0]?.id);
  if (!id) return errorResponse('insert failed', 500);

  await touchEntity('followup', { projectId });
  return okResponse({ id, projectId, status, due: due || null });
}
