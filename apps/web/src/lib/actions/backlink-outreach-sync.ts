// Bidirectional status reflection between a backlink TASK (human_tasks.site_status[slug]) and its
// linked outreach PROSPECT (outreach_prospects.status). Work in either surface — status stays shared.
// Advance-only (never regress) so the two reflect each other and can't ping-pong into a loop.
// Not a 'use server' entry point — imported by the mutation actions on both sides.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { siteTimingMerges } from '../backlink-timing';
import { touchEntity } from '@/lib/touch-entity';

const SITE_RANK: Record<string, number> = { pending: 0, claimed: 1, submitted: 2, completed: 3, verified: 4 };
const PROSPECT_RANK: Record<string, number> = { to_send: 0, sent: 1, followup_1: 2, followup_2: 3, replied: 4, interested: 5, embedded: 6 };
// prospect status → the site_status it implies
const P2S: Record<string, string> = { to_send: 'pending', sent: 'submitted', followup_1: 'submitted', followup_2: 'submitted', replied: 'submitted', interested: 'completed', embedded: 'completed' };
// site_status → the prospect status it implies
const S2P: Record<string, string> = { pending: 'to_send', claimed: 'to_send', submitted: 'sent', completed: 'interested', verified: 'interested' };

// A prospect changed → reflect onto its backlink task's site_status (advance only).
export async function syncProspectToTask(prospectId: number): Promise<void> {
  const db = getDb(); if (!db) return;
  try {
    const rows = await db.execute(sql`SELECT status, task_id, project_id FROM outreach_prospects WHERE id = ${prospectId} AND task_id IS NOT NULL LIMIT 1`);
    const p = (rows as unknown as Array<{ status: string; task_id: number; project_id: string }>)[0];
    if (!p) return;
    const target = P2S[p.status];
    if (!target) return;
    const slug = p.project_id;
    const tr = (await db.execute(sql`SELECT prep_payload->'site_status'->>${slug} AS cur FROM human_tasks WHERE id = ${p.task_id} LIMIT 1`)) as unknown as Array<{ cur: string | null }>;
    const cur = tr[0]?.cur ?? 'pending';
    if ((SITE_RANK[target] ?? -1) <= (SITE_RANK[cur] ?? -1)) return;   // advance only
    // Same canonical timing stamps as setBacklinkSite (submitted → waiting-since + auto follow-up date;
    // done → done-stamp + clear submitted/follow) — via the ONE shared helper, so the two never diverge.
    await db.execute(sql`
      UPDATE human_tasks
      SET prep_payload = jsonb_set(COALESCE(prep_payload, '{}'::jsonb), '{site_status}', COALESCE(prep_payload->'site_status','{}'::jsonb) || jsonb_build_object(${slug}::text, to_jsonb(${target}::text))) ${siteTimingMerges(slug, target, new Date().toISOString())},
          updated_at = now()
      WHERE id = ${p.task_id}`);
    await touchEntity('backlink', { projectId: p.project_id });   // task changed → bust its backlink/plays surfaces
  } catch { /* best-effort sync */ }
}

// A backlink task's site changed → reflect onto its linked prospect's status (advance only).
export async function syncTaskToProspect(taskId: number, slug: string, siteStatus: string): Promise<void> {
  const db = getDb(); if (!db) return;
  const target = S2P[siteStatus];
  if (!target) return;
  try {
    const rows = await db.execute(sql`SELECT id, status FROM outreach_prospects WHERE task_id = ${taskId} AND project_id = ${slug} LIMIT 1`);
    const p = (rows as unknown as Array<{ id: number; status: string }>)[0];
    if (!p) return;
    if ((PROSPECT_RANK[target] ?? -1) <= (PROSPECT_RANK[p.status] ?? -1)) return;   // advance only
    const extra = target === 'sent'
      ? sql`, sent_at = COALESCE(sent_at, now()), next_followup_at = COALESCE(next_followup_at, now() + interval '5 days')`
      : target === 'interested'
      ? sql`, next_followup_at = NULL`
      : sql``;
    await db.execute(sql`UPDATE outreach_prospects SET status = ${target} ${extra}, updated_at = now() WHERE id = ${p.id}`);
    await touchEntity('outreach', { projectId: slug });   // prospect changed → bust its outreach surface
  } catch { /* best-effort sync */ }
}
