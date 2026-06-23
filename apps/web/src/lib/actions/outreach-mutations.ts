'use server';

// Outreach pipeline mutations — called from the client /p/[id]/outreach page.
// Status auto-stamps timestamps + computes next_followup_at so the operator only clicks.
// 'embedded' is normally auto-set by the GA4 embed_host conversion cron (Phase 3); the
// manual "Mark embedded" button is a fallback for un-attributable embeds ('(direct)' referrer).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';

const FOLLOWUP_CAP = 2; // total follow-ups before a prospect is closed as 'no_response' (CAN-SPAM friendly)

async function rerender(projectId: string) {
  revalidatePath(`/p/${projectId}/outreach`);
}

export async function setProspectStatus(projectId: string, id: number, status: string) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    UPDATE outreach_prospects SET
      status = ${status},
      sent_at     = CASE WHEN ${status} = 'sent'                        THEN COALESCE(sent_at, now())     ELSE sent_at END,
      replied_at  = CASE WHEN ${status} IN ('replied','interested')     THEN COALESCE(replied_at, now())  ELSE replied_at END,
      embedded_at = CASE WHEN ${status} = 'embedded'                    THEN COALESCE(embedded_at, now()) ELSE embedded_at END,
      next_followup_at = CASE
        WHEN ${status} = 'sent' THEN now() + interval '3 days'
        WHEN ${status} IN ('replied','interested','embedded','declined','bounced','no_response') THEN NULL
        ELSE next_followup_at END,
      updated_at = now()
    WHERE id = ${id}`);
  await rerender(projectId);
}

export async function markFollowupSent(projectId: string, id: number) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    UPDATE outreach_prospects SET
      followup_count = followup_count + 1,
      status = CASE WHEN followup_count + 1 >= ${FOLLOWUP_CAP} THEN 'no_response'
                    ELSE 'followup_' || (followup_count + 1)::text END,
      next_followup_at = CASE WHEN followup_count + 1 >= ${FOLLOWUP_CAP} THEN NULL
                              ELSE now() + interval '4 days' END,
      updated_at = now()
    WHERE id = ${id} AND status IN ('sent','followup_1')`);
  await rerender(projectId);
}

export async function snoozeProspect(projectId: string, id: number, days = 7) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    UPDATE outreach_prospects SET snooze_until = now() + (${days}::int * interval '1 day'), updated_at = now()
    WHERE id = ${id}`);
  await rerender(projectId);
}

export async function updateProspectNotes(projectId: string, id: number, notes: string) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`UPDATE outreach_prospects SET notes = ${notes}, updated_at = now() WHERE id = ${id}`);
  await rerender(projectId);
}
