'use server';

// Outreach pipeline mutations — called from the client /p/[id]/outreach page.
// Status auto-stamps timestamps + computes next_followup_at so the operator only clicks.
// 'embedded' is normally auto-set by the GA4 embed_host conversion cron (Phase 3); the
// manual "Mark embedded" button is a fallback for un-attributable embeds ('(direct)' referrer).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { touchEntity } from '@/lib/touch-entity';
import { syncProspectToTask } from './backlink-outreach-sync';
import { getOutreachProspect } from './outreach';
import type { OutreachProspect } from './outreach';
import { listContentPillars } from './content-pillars';
import { genOutreachEmail } from '@/lib/outreach/email-content';

const FOLLOWUP_CAP = 2; // total follow-ups before a prospect is closed as 'no_response' (CAN-SPAM friendly)

// Client-callable loader (the reader in ./outreach is a plain server module) — for opening the
// Outreach drawer IN-PLACE from a linked backlink task's drawer.
export async function loadProspect(projectId: string, prospectId: number): Promise<OutreachProspect | null> {
  return getOutreachProspect(projectId, prospectId);
}

async function rerender(projectId: string) {
  await touchEntity('outreach', { projectId });
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
  await syncProspectToTask(id);
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
  await syncProspectToTask(id);
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
  await syncProspectToTask(id);
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

// AI-generate the outreach email FOR THIS PROJECT (product + its Content Pillar), not a hardcoded
// template. Mirrors genTouch (touch-content) but email-shaped and pillar-aware. Saves the draft so
// the auto-send cron (which prefers saved body) sends exactly what was generated + reviewed.
const EMAIL_FOLLOWUP = new Set(['sent', 'followup_1', 'followup_2', 'replied']);
export async function genProspectEmail(
  projectId: string, id: number,
): Promise<{ ok: boolean; subject?: string; body?: string; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  try {
    const rows = await db.execute(sql`
      SELECT p.agent_name, p.company, p.base, p.status, p.website AS p_site,
             c.from_name,
             pr.name AS product, pr.website AS website, pr.one_liner,
             ht.title AS src_title, ht.prep_payload->>'source_url' AS src_url
      FROM outreach_prospects p
      LEFT JOIN outreach_campaigns c ON c.id = p.campaign_id
      LEFT JOIN projects pr ON pr.id = p.project_id
      LEFT JOIN human_tasks ht ON ht.id = p.task_id
      WHERE p.id = ${id} AND p.project_id = ${projectId} LIMIT 1`);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!r) return { ok: false, error: 'prospect not found' };
    // Pillar chính của project: ưu tiên pillar khai báo dùng cho 'email', else pillar top-priority.
    const pillars = await listContentPillars(projectId);
    const pillar = pillars.find((pl) => pl.preferredTypes?.includes('email')) || pillars[0] || null;
    const fromName = String(r.from_name || 'Jake Miller');
    const out = await genOutreachEmail({
      product: String(r.product || ''), website: String(r.website || ''), oneLiner: String(r.one_liner || ''),
      ownerName: String(r.agent_name || r.company || ''), sourceTitle: String(r.src_title || ''),
      sourceUrl: String(r.src_url || r.p_site || ''), base: String(r.base || ''),
      signer: fromName.trim().split(/\s+/)[0] || 'Jake',
      isFollowup: EMAIL_FOLLOWUP.has(String(r.status || '')),
      positioning: pillar?.positioningMd, keyMessages: pillar?.keyMessages,
      forbiddenMsgs: pillar?.forbiddenMsgs, voiceNotes: pillar?.voiceNotes,
    });
    if (!out) return { ok: false, error: 'Không sinh được (AI off hoặc lỗi). Kiểm tra OPENAI_API_KEY.' };
    await db.execute(sql`
      UPDATE outreach_prospects SET email_subject = ${out.subject}, email_body = ${out.body}, updated_at = now()
      WHERE id = ${id} AND project_id = ${projectId}`);
    await rerender(projectId);
    return { ok: true, subject: out.subject, body: out.body };
  } catch (e) {
    return { ok: false, error: `gen lỗi: ${(e as Error).message}` };
  }
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
