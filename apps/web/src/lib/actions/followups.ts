'use server';

// Follow-ups = deferred / next-step work items = human_tasks with platform_key='followup'.
// A distinct kind so the backlinks view + task workers ignore them. Reuses existing columns —
// no migration: project_id=slug · title · instructions=context-to-resume · notes=progress log ·
// status ∈ FOLLOWUP_STATUS · sla_due_at = the come-back date. Rendered 📌 on the plays calendar.
// This module owns the DB writes; both the ext API (/api/ext/followups, CLI) and the drawer UI
// call these — one write-path, no duplicated SQL.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { touchEntity } from '@/lib/touch-entity';
import { isFollowupStatus, type Followup, type FollowupStatus } from '@/lib/followup-status';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9_-]+$/;

function mapRow(r: Record<string, unknown>): Followup {
  return {
    id: Number(r.id),
    projectId: String(r.project_id ?? ''),
    title: String(r.title ?? ''),
    status: (String(r.status ?? 'pending') as FollowupStatus),
    due: (r.due as string) ?? null,
    detail: String(r.instructions ?? ''),
    notes: String(r.notes ?? ''),
    updated: (r.updated as string) ?? null,
  };
}

// listFollowups() = all · listFollowups(slug) = one project · dueOnly = open + due today-or-earlier.
export async function listFollowups(projectId?: string, dueOnly = false): Promise<Followup[]> {
  const db = getDb(); if (!db) return [];
  const conds = [sql`platform_key = 'followup'`];
  if (projectId) conds.push(sql`project_id = ${projectId}`);
  if (dueOnly) conds.push(sql`status NOT IN ('done','dropped') AND sla_due_at IS NOT NULL AND sla_due_at::date <= now()::date`);
  const r = await db.execute(sql`
    SELECT id, project_id, title, status, to_char(sla_due_at, 'YYYY-MM-DD') AS due,
           instructions, notes, to_char(updated_at, 'YYYY-MM-DD') AS updated
    FROM human_tasks
    WHERE ${sql.join(conds, sql` AND `)}
    ORDER BY (status IN ('done','dropped')), sla_due_at NULLS LAST, id`);
  return (r as unknown as Record<string, unknown>[]).map(mapRow);
}

// One task, full record (title + detail = resume brief + notes = progress log) — what a fresh chat
// reads to continue THIS task with enough context. `followup show <id>` / GET ?id=<n>.
export async function getFollowup(id: number): Promise<Followup | null> {
  const db = getDb(); if (!db || !Number.isFinite(id)) return null;
  const r = await db.execute(sql`
    SELECT id, project_id, title, status, to_char(sla_due_at, 'YYYY-MM-DD') AS due,
           instructions, notes, to_char(updated_at, 'YYYY-MM-DD') AS updated
    FROM human_tasks WHERE id = ${id} AND platform_key = 'followup' LIMIT 1`);
  const row = (r as unknown as Record<string, unknown>[])[0];
  return row ? mapRow(row) : null;
}

export async function createFollowup(input: { projectId?: string; title?: string; detail?: string; due?: string; status?: string }): Promise<{ ok: boolean; id?: number; error?: string }> {
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const projectId = String(input.projectId ?? '').trim();
  const title = String(input.title ?? '').trim();
  if (!projectId || !title) return { ok: false, error: 'projectId, title required' };
  if (!SLUG_RE.test(projectId)) return { ok: false, error: 'projectId must be a slug [a-z0-9_-]' };
  const status = String(input.status ?? 'pending').trim();
  if (!isFollowupStatus(status)) return { ok: false, error: 'invalid status' };
  const due = String(input.due ?? '').trim();
  if (due && !DATE_RE.test(due)) return { ok: false, error: 'due must be YYYY-MM-DD' };
  const detail = String(input.detail ?? '').trim();

  const ins = await db.execute(sql`
    INSERT INTO human_tasks (tenant_id, project_id, title, instructions, prep_payload, platform_key, status, sla_due_at, completed_at)
    VALUES ('self', ${projectId}, ${title}, ${detail}, '{}'::jsonb, 'followup', ${status},
            ${due ? sql`${due}::date` : sql`NULL`}, ${status === 'done' ? sql`now()` : sql`NULL`})
    RETURNING id`);
  const id = Number((ins as unknown as Array<{ id: number }>)[0]?.id);
  if (!id) return { ok: false, error: 'insert failed' };
  await touchEntity('followup', { projectId });
  return { ok: true, id };
}

export async function updateFollowup(id: number, patch: { status?: string; due?: string; note?: string; title?: string }): Promise<{ ok: boolean; error?: string }> {
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  if (!Number.isFinite(id)) return { ok: false, error: 'bad id' };
  const cur = await db.execute(sql`SELECT project_id FROM human_tasks WHERE id = ${id} AND platform_key = 'followup' LIMIT 1`);
  const t = (cur as unknown as Array<{ project_id: string }>)[0];
  if (!t) return { ok: false, error: 'not a follow-up' };

  const sets = [sql`updated_at = now()`];
  if (patch.status !== undefined) {
    const s = String(patch.status).trim();
    if (!isFollowupStatus(s)) return { ok: false, error: 'invalid status' };
    sets.push(sql`status = ${s}`);
    sets.push(s === 'done' ? sql`completed_at = now()` : sql`completed_at = NULL`);
  }
  if (patch.due !== undefined) {
    const d = String(patch.due).trim();
    if (d && !DATE_RE.test(d)) return { ok: false, error: 'due must be YYYY-MM-DD or empty' };
    sets.push(d ? sql`sla_due_at = ${d}::date` : sql`sla_due_at = NULL`);
  }
  if (patch.title !== undefined) {
    const ti = String(patch.title).trim();
    if (!ti) return { ok: false, error: 'title cannot be empty' };
    sets.push(sql`title = ${ti}`);
  }
  if (patch.note !== undefined) {
    const n = String(patch.note).trim();
    if (n) sets.push(sql`notes = btrim(coalesce(notes, '') || E'\n' || to_char(now(), 'YYYY-MM-DD') || ' ' || ${n})`);
  }
  if (sets.length === 1) return { ok: false, error: 'nothing to update' };

  await db.execute(sql`UPDATE human_tasks SET ${sql.join(sets, sql`, `)} WHERE id = ${id} AND platform_key = 'followup'`);
  await touchEntity('followup', { projectId: String(t.project_id) });
  return { ok: true };
}

export async function deleteFollowup(id: number): Promise<{ ok: boolean; error?: string }> {
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  if (!Number.isFinite(id)) return { ok: false, error: 'bad id' };
  const r = await db.execute(sql`DELETE FROM human_tasks WHERE id = ${id} AND platform_key = 'followup' RETURNING project_id`);
  const row = (r as unknown as Array<{ project_id: string }>)[0];
  if (!row) return { ok: false, error: 'not a follow-up' };
  await touchEntity('followup', { projectId: String(row.project_id) });
  return { ok: true };
}
