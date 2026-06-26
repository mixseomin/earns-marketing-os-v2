'use server';

// Outreach automation: one daily pass that (1) sends every due follow-up and
// (2) sends a paced batch of fresh cold pitches. Reuses sendProspectEmail so the
// pipeline-advance + Mailjet logic stays in one place. Triggered by a systemd timer
// hitting /api/cron/outreach (x-cron-secret). Project-agnostic - reads project_id per row.
//
// Cold-send pacing: INITIAL_DAILY_CAP keeps cold volume low so militarycalc.com's
// sender reputation (shared with the 11k newsletter) stays clean and the sends read
// human, not bulk. Follow-ups are capped at 2 per prospect by sendProspectEmail itself.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sendProspectEmail } from './outreach-send';

const INITIAL_DAILY_CAP = 15; // fresh cold pitches per run (warmup ramp from 8; raise as bounce/spam stays clean)
const FOLLOWUP_PER_RUN = 25; // generous - follow-ups go to already-contacted, lower risk

type Row = { id: number; project_id: string };

export async function runOutreachCron(): Promise<{
  ok: boolean;
  followups: number;
  initials: number;
  errors: string[];
}> {
  const db = getDb();
  if (!db) return { ok: false, followups: 0, initials: 0, errors: ['DB unavailable'] };
  const errors: string[] = [];

  // 1) Due follow-ups: already contacted, not snoozed, still has a follow-up left.
  const due = (await db.execute(sql`
    SELECT id, project_id FROM outreach_prospects
    WHERE status IN ('sent','followup_1')
      AND email IS NOT NULL AND email <> ''
      AND next_followup_at IS NOT NULL AND next_followup_at <= now()
      AND (snooze_until IS NULL OR snooze_until <= now())
    ORDER BY next_followup_at ASC
    LIMIT ${FOLLOWUP_PER_RUN}`)) as unknown as Row[];

  let followups = 0;
  for (const r of due) {
    const res = await sendProspectEmail(String(r.project_id), Number(r.id));
    if (res.ok) followups++;
    else errors.push(`followup#${r.id}: ${res.error}`);
  }

  // 2) Paced fresh cold pitches.
  const fresh = (await db.execute(sql`
    SELECT id, project_id FROM outreach_prospects
    WHERE status = 'to_send'
      AND email IS NOT NULL AND email <> ''
      AND (snooze_until IS NULL OR snooze_until <= now())
    ORDER BY id ASC
    LIMIT ${INITIAL_DAILY_CAP}`)) as unknown as Row[];

  let initials = 0;
  for (const r of fresh) {
    const res = await sendProspectEmail(String(r.project_id), Number(r.id));
    if (res.ok) initials++;
    else errors.push(`initial#${r.id}: ${res.error}`);
  }

  return { ok: true, followups, initials, errors };
}
