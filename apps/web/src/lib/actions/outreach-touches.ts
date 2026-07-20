'use server';

// Multi-channel outreach touches — CRUD + per-channel content gen + mark-sent. Email/form live on the
// prospect (auto-send unchanged); these are the EXTRA channels (social DM, comment, dev). A touch
// marked 'sent' advances the prospect (→ backlink task sync). See 2026-07-20-outreach-multichannel-plan.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { syncProspectToTask } from './backlink-outreach-sync';
import { genChannelContent } from '@/lib/outreach/touch-content';
import { firstNameOf } from '@/lib/outreach/link-task';

async function isAdmin(): Promise<boolean> {
  const me = await getCurrentUser();
  return me?.role === 'admin';
}

export interface Touch { id: number; channel: string; targetRef: string; content: string; status: string; sentAt: string | null }

const mapTouch = (r: Record<string, unknown>): Touch => ({
  id: Number(r.id), channel: String(r.channel), targetRef: String(r.target_ref ?? ''), content: String(r.content ?? ''),
  status: String(r.status ?? 'to_send'), sentAt: r.sent_at ? String(r.sent_at) : null,
});

// Campaign sender for this prospect (de-hardcode the email drawer's From line). Fallback = militarycalc.
export async function getProspectSender(projectId: string, prospectId: number): Promise<{ name: string; email: string }> {
  const db = getDb(); if (!db) return { name: 'Jake Miller', email: 'hello@militarycalc.com' };
  const rows = await db.execute(sql`SELECT c.from_name, c.from_email FROM outreach_prospects p LEFT JOIN outreach_campaigns c ON c.id = p.campaign_id WHERE p.id = ${prospectId} AND p.project_id = ${projectId} LIMIT 1`);
  const r = (rows as unknown as Array<{ from_name: string | null; from_email: string | null }>)[0];
  return { name: r?.from_name || 'Jake Miller', email: r?.from_email || 'hello@militarycalc.com' };
}

export async function listTouches(projectId: string, prospectId: number): Promise<Touch[]> {
  const db = getDb(); if (!db) return [];
  const rows = await db.execute(sql`SELECT id, channel, target_ref, content, status, sent_at FROM outreach_touches WHERE prospect_id = ${prospectId} AND project_id = ${projectId} ORDER BY created_at`);
  return (rows as unknown as Array<Record<string, unknown>>).map(mapTouch);
}

// Add (or re-target) a channel for this prospect. Unique (prospect, channel) → idempotent.
export async function addTouch(projectId: string, prospectId: number, channel: string, targetRef: string): Promise<{ ok: boolean; touch?: Touch; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  try {
    const ins = await db.execute(sql`
      INSERT INTO outreach_touches (tenant_id, prospect_id, project_id, channel, target_ref)
      VALUES ('self', ${prospectId}, ${projectId}, ${channel}, ${targetRef || null})
      ON CONFLICT (prospect_id, channel) DO UPDATE SET target_ref = COALESCE(EXCLUDED.target_ref, outreach_touches.target_ref), updated_at = now()
      RETURNING id, channel, target_ref, content, status, sent_at`);
    revalidatePath(`/p/${projectId}/outreach`);
    return { ok: true, touch: mapTouch((ins as unknown as Array<Record<string, unknown>>)[0]!) };
  } catch (e) { return { ok: false, error: `add touch lỗi: ${(e as Error).message}` }; }
}

export async function saveTouch(projectId: string, touchId: number, patch: { targetRef?: string; content?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`UPDATE outreach_touches SET target_ref = COALESCE(${patch.targetRef ?? null}, target_ref), content = COALESCE(${patch.content ?? null}, content), updated_at = now() WHERE id = ${touchId} AND project_id = ${projectId}`);
  return { ok: true };
}

// Generate the per-channel message for a touch (voice differs from email). Saves + returns it.
export async function genTouch(projectId: string, prospectId: number, touchId: number): Promise<{ ok: boolean; content?: string; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  try {
    const rows = await db.execute(sql`
      SELECT t.channel, t.target_ref, p.agent_name, p.company, p.website AS p_site,
             c.from_name, pr.name AS product, pr.website AS website, pr.one_liner,
             ht.title AS src_title, ht.prep_payload->>'source_url' AS src_url
      FROM outreach_touches t
      JOIN outreach_prospects p ON p.id = t.prospect_id
      LEFT JOIN outreach_campaigns c ON c.id = p.campaign_id
      LEFT JOIN projects pr ON pr.id = t.project_id
      LEFT JOIN human_tasks ht ON ht.id = p.task_id
      WHERE t.id = ${touchId} AND t.project_id = ${projectId} LIMIT 1`);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!r) return { ok: false, error: 'touch not found' };
    const content = await genChannelContent({
      product: String(r.product || ''), website: String(r.website || ''), oneLiner: String(r.one_liner || ''),
      ownerName: String(r.agent_name || r.company || ''), sourceTitle: String(r.src_title || ''),
      sourceUrl: String(r.src_url || r.p_site || ''), targetRef: String(r.target_ref || ''),
      channel: String(r.channel), signer: firstNameOf(String(r.from_name || '')) || 'Jake',
    });
    if (!content) return { ok: false, error: 'không sinh được nội dung' };
    await db.execute(sql`UPDATE outreach_touches SET content = ${content}, updated_at = now() WHERE id = ${touchId}`);
    return { ok: true, content };
  } catch (e) { return { ok: false, error: `gen lỗi: ${(e as Error).message}` }; }
}

// Mark a touch sent (ext-assisted: operator pasted + sent). Advances the prospect if still to_send so
// the backlink task reflects "reached out" (syncProspectToTask). meta can carry the permalink.
export async function markTouchSent(projectId: string, prospectId: number, touchId: number, meta?: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  try {
    await db.execute(sql`UPDATE outreach_touches SET status = 'sent', sent_at = COALESCE(sent_at, now()), meta = meta || ${JSON.stringify(meta || {})}::jsonb, updated_at = now() WHERE id = ${touchId} AND project_id = ${projectId}`);
    // Advance prospect to 'sent' if still queued → reflect onto the backlink task.
    await db.execute(sql`UPDATE outreach_prospects SET status = 'sent', sent_at = COALESCE(sent_at, now()), next_followup_at = COALESCE(next_followup_at, now() + interval '5 days'), updated_at = now() WHERE id = ${prospectId} AND status = 'to_send'`);
    await syncProspectToTask(prospectId);
    revalidatePath(`/p/${projectId}/outreach`);
    return { ok: true };
  } catch (e) { return { ok: false, error: `mark lỗi: ${(e as Error).message}` }; }
}

export async function deleteTouch(projectId: string, touchId: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`DELETE FROM outreach_touches WHERE id = ${touchId} AND project_id = ${projectId}`);
  revalidatePath(`/p/${projectId}/outreach`);
  return { ok: true };
}
