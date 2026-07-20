'use server';

// Outreach campaigns CRUD + stats. A campaign groups prospects by GOAL (embed|backlink|sales|
// recruit) and carries its own sender identity + pacing. Prospect-based campaigns (embed/sales/
// recruit) live here; the backlink "campaign" is tracked in the backlink CRM, surfaced read-only.
// Decision: earns-strategy 2026-07-04-outreach-multi-campaign-platform.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { aiEnabled } from '@/lib/ai/openai';
import { EMAIL_RE, genPitch, ensureBacklinkCampaign, linkTaskToOutreachCore } from '@/lib/outreach/link-task';

async function isAdmin(): Promise<boolean> {
  const me = await getCurrentUser();
  return me?.role === 'admin';
}

export type OutreachCampaign = {
  id: number;
  projectId: string | null;
  name: string;
  type: string;
  status: string;
  goal: string | null;
  fromEmail: string | null;
  fromName: string | null;
  dailyCap: number;
  followupGapDays: number;
  maxFollowups: number;
  autoSend: boolean;
  notes: string | null;
  stats: { prospects: number; sent: number; replied: number; won: number };
};

export async function listCampaigns(projectId: string): Promise<OutreachCampaign[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.execute(sql`
      SELECT c.id, c.project_id, c.name, c.type, c.status, c.goal, c.from_email, c.from_name,
             c.daily_cap, c.followup_gap_days, c.max_followups, c.auto_send, c.notes,
             count(p.id)                                                        AS prospects,
             count(p.id) FILTER (WHERE p.sent_at IS NOT NULL)                   AS sent,
             count(p.id) FILTER (WHERE p.status IN ('replied','interested'))    AS replied,
             count(p.id) FILTER (WHERE p.status IN ('embedded'))                AS won
      FROM outreach_campaigns c
      LEFT JOIN outreach_prospects p ON p.campaign_id = c.id
      WHERE c.project_id = ${projectId}
      GROUP BY c.id
      ORDER BY c.created_at ASC, c.id ASC`);
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      projectId: (r.project_id as string | null) ?? null,
      name: String(r.name ?? ''),
      type: String(r.type ?? 'embed'),
      status: String(r.status ?? 'active'),
      goal: (r.goal as string | null) ?? null,
      fromEmail: (r.from_email as string | null) ?? null,
      fromName: (r.from_name as string | null) ?? null,
      dailyCap: Number(r.daily_cap ?? 0),
      followupGapDays: Number(r.followup_gap_days ?? 0),
      maxFollowups: Number(r.max_followups ?? 0),
      autoSend: r.auto_send === true,
      notes: (r.notes as string | null) ?? null,
      stats: { prospects: Number(r.prospects ?? 0), sent: Number(r.sent ?? 0), replied: Number(r.replied ?? 0), won: Number(r.won ?? 0) },
    }));
  } catch {
    return [];
  }
}

export async function createCampaign(input: {
  projectId: string; name: string; type: string; goal?: string; autoSend?: boolean;
  fromEmail?: string; fromName?: string; dailyCap?: number; followupGapDays?: number; maxFollowups?: number;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'thiếu tên campaign' };
  // Quality-first default: backlink outreach is hand-sent unless opted into auto; everything else auto.
  const autoSend = input.autoSend ?? (input.type !== 'backlink');
  try {
    const ins = await db.execute(sql`
      INSERT INTO outreach_campaigns (tenant_id, project_id, name, type, status, goal, from_email, from_name, daily_cap, followup_gap_days, max_followups, auto_send)
      VALUES ('self', ${input.projectId}, ${name}, ${input.type || 'custom'}, 'active', ${input.goal ?? null},
              ${input.fromEmail ?? null}, ${input.fromName ?? null},
              ${input.dailyCap ?? 15}, ${input.followupGapDays ?? 3}, ${input.maxFollowups ?? 2}, ${autoSend})
      RETURNING id`);
    revalidatePath(`/p/${input.projectId}/outreach`);
    return { ok: true, id: Number((ins as unknown as Array<{ id: number }>)[0]?.id) };
  } catch (e) {
    return { ok: false, error: `create lỗi: ${(e as Error).message}` };
  }
}

export async function updateCampaign(id: number, projectId: string, patch: {
  name?: string; type?: string; status?: string; goal?: string; autoSend?: boolean;
  fromEmail?: string; fromName?: string; dailyCap?: number; followupGapDays?: number; maxFollowups?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const sets = [];
  if (patch.name !== undefined) sets.push(sql`name = ${patch.name.trim()}`);
  if (patch.type !== undefined) sets.push(sql`type = ${patch.type}`);
  if (patch.status !== undefined) sets.push(sql`status = ${patch.status}`);
  if (patch.autoSend !== undefined) sets.push(sql`auto_send = ${patch.autoSend}`);
  if (patch.goal !== undefined) sets.push(sql`goal = ${patch.goal}`);
  if (patch.fromEmail !== undefined) sets.push(sql`from_email = ${patch.fromEmail}`);
  if (patch.fromName !== undefined) sets.push(sql`from_name = ${patch.fromName}`);
  if (patch.dailyCap !== undefined) sets.push(sql`daily_cap = ${patch.dailyCap}`);
  if (patch.followupGapDays !== undefined) sets.push(sql`followup_gap_days = ${patch.followupGapDays}`);
  if (patch.maxFollowups !== undefined) sets.push(sql`max_followups = ${patch.maxFollowups}`);
  if (!sets.length) return { ok: true };
  sets.push(sql`updated_at = now()`);
  try {
    await db.execute(sql`UPDATE outreach_campaigns SET ${sql.join(sets, sql`, `)} WHERE id = ${id}`);
    revalidatePath(`/p/${projectId}/outreach`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `update lỗi: ${(e as Error).message}` };
  }
}

// ── Backlink → outreach automation ───────────────────────────────────────────
// Import backlink tasks (that need an email pitch) into the project's backlink campaign as
// to_send prospects WITH an AI-generated pitch stored on each, so the outreach cron auto-sends
// them (initial + follow-ups) with zero clicking. Form-only tasks (no recipient email) are left
// for the Backlinks tab (mandatory manual). Idempotent via notes marker. Also backfills content
// for backlink prospects that were bridged without an email body. EMAIL_RE + genPitch +
// ensureBacklinkCampaign shared with the single-task linker in @/lib/outreach/link-task.

export async function importBacklinkTasks(projectId: string): Promise<{ ok: boolean; created: number; filled: number; skippedForm: number; error?: string }> {
  if (!(await isAdmin())) return { ok: false, created: 0, filled: 0, skippedForm: 0, error: 'forbidden' };
  if (!aiEnabled()) return { ok: false, created: 0, filled: 0, skippedForm: 0, error: 'OPENAI_API_KEY chưa cấu hình' };
  const db = getDb();
  if (!db) return { ok: false, created: 0, filled: 0, skippedForm: 0, error: 'no db' };
  try {
    const campId = (await ensureBacklinkCampaign(db, projectId)).id;

    const proj = ((await db.execute(sql`SELECT name, website, one_liner, bio FROM projects WHERE id = ${projectId} LIMIT 1`)) as unknown as Array<Record<string, unknown>>)[0] || {};

    // 1) New email-pitch tasks → prospects with generated content. Skip completed/verified + already-imported.
    const tasks = (await db.execute(sql`
      SELECT id, title, prep_payload->>'source_url' AS source_url, prep_payload->>'mechanism' AS mechanism, instructions,
             substring(coalesce(prep_payload->>'mechanism','') || ' ' || coalesce(instructions,'') FROM ${EMAIL_RE}) AS email
      FROM human_tasks
      WHERE platform_key = 'backlink' AND prep_payload->'site_status' ? ${projectId}
        AND coalesce(prep_payload->'site_status'->>${projectId},'') NOT IN ('completed','verified')
        AND substring(coalesce(prep_payload->>'mechanism','') || ' ' || coalesce(instructions,'') FROM ${EMAIL_RE}) IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM outreach_prospects p WHERE p.notes = 'từ backlink task #' || human_tasks.id)
      ORDER BY id`)) as unknown as Array<Record<string, unknown>>;

    let created = 0, skippedForm = 0;
    for (const t of tasks) {
      const pitch = await genPitch(proj, t);
      if (!pitch) continue;
      const host = String(t.source_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || String(t.title || 'site');
      await db.execute(sql`INSERT INTO outreach_prospects (tenant_id, project_id, campaign_id, task_id, agent_name, company, email, website, status, source, email_subject, email_body, notes)
        VALUES ('self', ${projectId}, ${campId}, ${Number(t.id)}, ${host}, ${String(t.title ?? '')}, ${String(t.email ?? '')}, ${String(t.source_url ?? '')}, 'to_send', 'backlink', ${pitch.subject}, ${pitch.body}, ${'từ backlink task #' + String(t.id)})
        ON CONFLICT (project_id, email) DO NOTHING`);
      created++;
    }

    // 2) Backfill content for existing backlink prospects that have an email but no body (e.g. SQL-bridged).
    const need = (await db.execute(sql`SELECT id, notes FROM outreach_prospects WHERE campaign_id = ${campId} AND source = 'backlink' AND email IS NOT NULL AND email <> '' AND (email_body IS NULL OR email_body = '')`)) as unknown as Array<{ id: number; notes: string | null }>;
    let filled = 0;
    for (const p of need) {
      const tid = Number((p.notes || '').match(/#(\d+)/)?.[1] || 0);
      if (!tid) continue;
      const tr = ((await db.execute(sql`SELECT id, title, prep_payload->>'source_url' AS source_url, prep_payload->>'mechanism' AS mechanism, instructions FROM human_tasks WHERE id = ${tid} LIMIT 1`)) as unknown as Array<Record<string, unknown>>)[0];
      if (!tr) continue;
      const pitch = await genPitch(proj, tr);
      if (!pitch) continue;
      await db.execute(sql`UPDATE outreach_prospects SET email_subject = ${pitch.subject}, email_body = ${pitch.body}, updated_at = now() WHERE id = ${p.id}`);
      filled++;
    }

    revalidatePath(`/p/${projectId}/outreach`);
    return { ok: true, created, filled, skippedForm };
  } catch (e) {
    return { ok: false, created: 0, filled: 0, skippedForm: 0, error: `import lỗi: ${(e as Error).message}` };
  }
}

// Link ONE backlink task to outreach (from its drawer / the ext) — ensure campaign + prospect + pitch,
// return a deep link to open it. For direct-contact placements (email the site owner/maintainer). Admin
// cookie; the ext uses the token-authed route /api/ext/tasks/[id]/outreach (same core).
export async function linkTaskToOutreach(taskId: number) {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const r = await linkTaskToOutreachCore(db, taskId);
  if (r.ok && r.projectId) revalidatePath(`/p/${r.projectId}/outreach`);
  return r;
}
