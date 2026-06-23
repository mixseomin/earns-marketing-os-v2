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
        WHEN ${status} IN ('replied','interested','embedded','declined','bounced','no_response','unreachable') THEN NULL
        ELSE next_followup_at END,
      updated_at = now()
    WHERE id = ${id}`);
  await rerender(projectId);
}

// Form-only prospect: you submitted their contact form by hand. Marks contacted (= 'sent') but
// schedules NO email follow-up (you can't reliably nudge a web form). Conversion still comes from GA4.
export async function markFormSubmitted(projectId: string, id: number) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    UPDATE outreach_prospects SET status = 'sent', sent_at = COALESCE(sent_at, now()),
      next_followup_at = NULL, updated_at = now()
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

// Save the operator's edited email without sending — survives reopen.
export async function updateProspectDraft(projectId: string, id: number, data: { subject: string; body: string }) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    UPDATE outreach_prospects SET email_subject = ${data.subject}, email_body = ${data.body}, updated_at = now()
    WHERE id = ${id}`);
  await rerender(projectId);
}

function etld1FromUrl(u: string): string | null {
  if (!u) return null;
  try {
    return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

// Fix a prospect's contact info from what you actually find on their site (field reality):
// correct the form link, the website, or ADD an email you discovered (which upgrades a FORM-only
// prospect to EMAIL so it can auto-send). website_etld1 is recomputed so the embed-conversion join stays correct.
export async function updateProspectContact(
  projectId: string,
  id: number,
  data: { email?: string | null; contactUrl?: string | null; website?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  const norm = (v?: string | null) => { const s = (v ?? '').trim(); return s ? s : null; };
  const email = norm(data.email);
  const contactUrl = norm(data.contactUrl);
  const website = norm(data.website) ?? '';
  try {
    await db.execute(sql`
      UPDATE outreach_prospects SET
        email = ${email}, contact_url = ${contactUrl},
        website = ${website}, website_etld1 = ${etld1FromUrl(website)},
        updated_at = now()
      WHERE id = ${id} AND project_id = ${projectId}`);
  } catch (e) {
    const msg = String(e);
    if (/unique|duplicate/i.test(msg)) return { ok: false, error: 'That email is already on another prospect' };
    return { ok: false, error: msg.slice(0, 160) };
  }
  await rerender(projectId);
  return { ok: true };
}
