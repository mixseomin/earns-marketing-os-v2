'use server';
// Send-ready package for an email-issue task, stored in human_tasks.prep_payload->'email'.
// Everything the real send needs, prepared up front: the actual email (from/subject/preheader/
// body), the recipient list, the send time, the offer link. Lazy-fetched by the drawer (like
// getOfferNote) so it never bloats the plays list. Standard shape → every 📧 card is identical.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export interface EmailPrep {
  fromName: string;
  fromEmail: string;
  subject: string;        // primary subject line
  subjectB: string;       // optional A/B variant
  preheader: string;      // inbox preview text
  bodyMd: string;         // the real email body (what recipients read)
  listName: string;       // e.g. "MilitaryCalc list"
  segment: string;        // e.g. "Engaged (opened ≤90d)"
  recipientCount: string; // e.g. "~800"
  listTotal: string;      // e.g. "11,028"
  // Send DATE is NOT here — it lives on the card schedule (siteScheduledAt / the calendar) and
  // shifts with strategy. Only the time-of-day lives here: the "golden hour" from analysing when
  // the audience actually opens, constant across whatever date the issue lands on.
  sendTime: string;       // 'HH:mm' local time-of-day
  sendTimeWhy: string;    // why this hour (demand analysis note)
  provider: string;       // e.g. "Mailjet"
  offerLabel: string;
  offerUrl: string;
  status: 'draft' | 'ready';
}

export const EMPTY_EMAIL_PREP: EmailPrep = {
  fromName: '', fromEmail: '', subject: '', subjectB: '', preheader: '', bodyMd: '',
  listName: '', segment: '', recipientCount: '', listTotal: '', sendTime: '', sendTimeWhy: '', provider: 'Mailjet',
  offerLabel: '', offerUrl: '', status: 'draft',
};

export async function getEmailPrep(taskId: number): Promise<EmailPrep | null> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return null;
  const db = getDb();
  if (!db) return null;
  const rows = (await db.execute(
    sql`SELECT prep_payload->'email' AS email FROM human_tasks WHERE id = ${taskId} LIMIT 1`,
  )) as unknown as Array<{ email: unknown }>;
  const e = rows[0]?.email;
  if (!e || typeof e !== 'object') return null;
  return { ...EMPTY_EMAIL_PREP, ...(e as Partial<EmailPrep>) };
}

export async function saveEmailPrep(taskId: number, prep: EmailPrep): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return { ok: false, error: 'admin-only' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`
    UPDATE human_tasks
       SET prep_payload = COALESCE(prep_payload, '{}'::jsonb) || jsonb_build_object('email', ${JSON.stringify(prep)}::jsonb),
           updated_at = now()
     WHERE id = ${taskId}`);
  return { ok: true };
}
