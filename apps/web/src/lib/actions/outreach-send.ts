'use server';

// Auto-send a prospect's pitch email via Mailjet (from hello@militarycalc.com) and advance the
// pipeline in one click. Email-only — form-only prospects must be sent manually. The email body is
// rebuilt server-side from the same template the preview drawer shows, so what you see is what sends.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';
import { buildEmailForProspect } from '@/lib/outreach-template';

const FROM_EMAIL = process.env.MAILJET_FROM || 'hello@militarycalc.com';
const FROM_NAME = 'Jake Miller';

export async function sendProspectEmail(
  projectId: string,
  id: number,
  override?: { subject?: string; body?: string },
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  const key = process.env.MAILJET_API_KEY;
  const secret = process.env.MAILJET_SECRET;
  if (!key || !secret) return { ok: false, error: 'Mailjet not configured on server' };

  const rows = await db.execute(sql`
    SELECT agent_name, base, email, status FROM outreach_prospects
    WHERE id = ${id} AND project_id = ${projectId} LIMIT 1`);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'Prospect not found' };

  const email = r.email ? String(r.email) : '';
  if (!email) return { ok: false, error: 'Form-only prospect — no email to auto-send' };
  const status = String(r.status ?? 'to_send');

  if (['replied', 'interested', 'embedded', 'declined', 'bounced'].includes(status)) {
    return { ok: false, error: `Already ${status} — not sending` };
  }

  const tpl = buildEmailForProspect({
    agentName: r.agent_name as string | null,
    base: r.base as string | null,
    status,
  });
  // Use the operator's edited subject/body when provided (they fix the greeting etc. in the drawer).
  const subject = override?.subject?.trim() || tpl.subject;
  const body = override?.body?.trim() || tpl.body;

  let resp: Response;
  try {
    resp = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64'),
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: FROM_EMAIL, Name: FROM_NAME },
            To: [{ Email: email, Name: String(r.agent_name ?? '') }],
            ReplyTo: { Email: FROM_EMAIL, Name: FROM_NAME },
            Subject: subject,
            TextPart: body,
          },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, error: `Network: ${String(e).slice(0, 160)}` };
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    return { ok: false, error: `Mailjet ${resp.status}: ${t.slice(0, 180)}` };
  }
  const j = (await resp.json().catch(() => ({}))) as { Messages?: Array<{ Status?: string }> };
  const st = j?.Messages?.[0]?.Status;
  if (st && st !== 'success') return { ok: false, error: `Mailjet status: ${st}` };

  // Advance pipeline: initial send -> 'sent' (+3d); a follow-up send -> cadence (cap 2 -> no_response).
  if (status === 'to_send') {
    await db.execute(sql`
      UPDATE outreach_prospects SET
        status = 'sent', sent_at = COALESCE(sent_at, now()),
        next_followup_at = now() + interval '3 days', updated_at = now()
      WHERE id = ${id}`);
  } else {
    await db.execute(sql`
      UPDATE outreach_prospects SET
        followup_count = followup_count + 1,
        status = CASE WHEN followup_count + 1 >= 2 THEN 'no_response' ELSE 'followup_' || (followup_count + 1)::text END,
        next_followup_at = CASE WHEN followup_count + 1 >= 2 THEN NULL ELSE now() + interval '4 days' END,
        updated_at = now()
      WHERE id = ${id}`);
  }

  revalidatePath(`/p/${projectId}/outreach`);
  return { ok: true };
}
