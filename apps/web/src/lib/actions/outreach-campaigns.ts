'use server';

// Outreach campaigns CRUD + stats. A campaign groups prospects by GOAL (embed|backlink|sales|
// recruit) and carries its own sender identity + pacing. Prospect-based campaigns (embed/sales/
// recruit) live here; the backlink "campaign" is tracked in the backlink CRM, surfaced read-only.
// Decision: earns-strategy 2026-07-04-outreach-multi-campaign-platform.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';

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
  notes: string | null;
  stats: { prospects: number; sent: number; replied: number; won: number };
};

export async function listCampaigns(projectId: string): Promise<OutreachCampaign[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.execute(sql`
      SELECT c.id, c.project_id, c.name, c.type, c.status, c.goal, c.from_email, c.from_name,
             c.daily_cap, c.followup_gap_days, c.max_followups, c.notes,
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
      notes: (r.notes as string | null) ?? null,
      stats: { prospects: Number(r.prospects ?? 0), sent: Number(r.sent ?? 0), replied: Number(r.replied ?? 0), won: Number(r.won ?? 0) },
    }));
  } catch {
    return [];
  }
}

export async function createCampaign(input: {
  projectId: string; name: string; type: string; goal?: string;
  fromEmail?: string; fromName?: string; dailyCap?: number; followupGapDays?: number; maxFollowups?: number;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'thiếu tên campaign' };
  try {
    const ins = await db.execute(sql`
      INSERT INTO outreach_campaigns (tenant_id, project_id, name, type, status, goal, from_email, from_name, daily_cap, followup_gap_days, max_followups)
      VALUES ('self', ${input.projectId}, ${name}, ${input.type || 'custom'}, 'active', ${input.goal ?? null},
              ${input.fromEmail ?? null}, ${input.fromName ?? null},
              ${input.dailyCap ?? 15}, ${input.followupGapDays ?? 3}, ${input.maxFollowups ?? 2})
      RETURNING id`);
    revalidatePath(`/p/${input.projectId}/outreach`);
    return { ok: true, id: Number((ins as unknown as Array<{ id: number }>)[0]?.id) };
  } catch (e) {
    return { ok: false, error: `create lỗi: ${(e as Error).message}` };
  }
}

export async function updateCampaign(id: number, projectId: string, patch: {
  name?: string; type?: string; status?: string; goal?: string;
  fromEmail?: string; fromName?: string; dailyCap?: number; followupGapDays?: number; maxFollowups?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const sets = [];
  if (patch.name !== undefined) sets.push(sql`name = ${patch.name.trim()}`);
  if (patch.type !== undefined) sets.push(sql`type = ${patch.type}`);
  if (patch.status !== undefined) sets.push(sql`status = ${patch.status}`);
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
