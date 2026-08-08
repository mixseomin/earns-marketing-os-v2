'use server';
// Send-ready package for an email-issue task, stored in human_tasks.prep_payload->'email'.
// Everything the real send needs, prepared up front: the actual email (from/subject/preheader/
// body), the recipient list, the send time, the offer link. Lazy-fetched by the drawer (like
// getOfferNote) so it never bloats the plays list. Standard shape → every 📧 card is identical.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { logAiUsage } from '@/lib/ai/usage';
// Type + empty default live in a PLAIN module — a 'use server' file may only export async functions,
// so the value/type must not be declared here (was crashing /plays + /communities at runtime).
import { type EmailPrep, EMPTY_EMAIL_PREP } from '@/lib/email-prep-shape';

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

// AI-write the real email from the card brief + the CHOSEN offer + audience. The offer is required:
// you pick a real offer first (from /offers), then the AI writes copy woven around BOTH that offer
// and the card's content theme. Hook goes on line 1 (no formal intro). Returns subject A/B, preheader,
// body, and 3-5 key points (the email's gist). English, human-voice (public content).
export async function generateEmailPrep(
  taskId: number,
  ctx: { offerLabel?: string; offerUrl?: string; segment?: string; audience?: string },
): Promise<{ ok: boolean; subjectA?: string; subjectB?: string; preheader?: string; bodyMd?: string; keyPoints?: string[]; error?: string }> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return { ok: false, error: 'admin-only' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  // Offer-first: no email without a real offer to build around (the card content + offer must cohere).
  const offer = (ctx.offerLabel || '').trim();
  if (!offer) return { ok: false, error: 'Chọn offer trước — AI viết mail bám theo offer + nội dung.' };
  const client = getOpenAI();
  if (!client) return { ok: false, error: 'OpenAI client unavailable' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };

  const rows = (await db.execute(sql`
    SELECT ht.title, ht.instructions, ht.project_id, p.name, p.one_liner, p.website
      FROM human_tasks ht LEFT JOIN projects p ON p.id = ht.project_id
     WHERE ht.id = ${taskId} LIMIT 1`)) as unknown as Array<Record<string, string | null>>;
  const t = rows[0];
  if (!t) return { ok: false, error: 'task not found' };

  const audience = ctx.audience || t.name || 'the newsletter list';
  const system = `You are an email copywriter for a passive-income marketing portfolio. Write natural, human copy that sounds like one person emailing another.
STRICT: English only. Use "-" not em dashes. No AI-tell phrases ("in today's fast-paced world", "unlock", "dive in", "elevate", "moreover", "in conclusion"). Short paragraphs.
HOOK FIRST: line 1 must be the payoff - a concrete claim, number, or open loop that stops the scroll. NEVER open with a formal intro, a greeting-then-throat-clearing, or "I wanted to tell you about...". The greeting line ("Hey {{first_name|there}},") may come first, then the hook immediately.
The offer is the tool that solves the reader's real pain - weave it into the story, do not bolt a sales pitch on the end. One soft CTA. Value-first, concrete, no hype.`;
  const user = `Write ONE newsletter email that is coherent with BOTH the content theme AND the offer below.
Product/brand: ${t.name || ''}${t.website ? ` (${t.website})` : ''} — ${t.one_liner || ''}
Audience: ${audience}${ctx.segment ? ` · segment: ${ctx.segment}` : ''}
Content theme / brief: ${t.title || ''}
${t.instructions ? `Notes/outline:\n${t.instructions}` : ''}
OFFER to promote (the natural recommendation inside the story): ${offer}. Put the link exactly as "${ctx.offerUrl || '[ offer link ]'}" where it belongs.

Return JSON: {
  "subjectA": "≤60 chars, hook/curiosity",
  "subjectB": "≤60 chars, different angle for A/B",
  "preheader": "≤90 chars inbox preview that extends the subject",
  "bodyMd": "full email body, plain text, blank lines between paragraphs. Greeting then HOOK on the next line. End with a one-click unsubscribe + physical-address footer placeholder.",
  "keyPoints": ["3 to 5 very short bullets naming the email's main beats in order (hook → problem → offer as fix → CTA)"]
}`;

  try {
    const res = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
    });
    logAiUsage('email-prep', DEFAULT_MODEL, res.usage, t.project_id);
    const p = JSON.parse(res.choices[0]?.message?.content ?? '{}') as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 5) : []);
    return { ok: true, subjectA: s(p.subjectA), subjectB: s(p.subjectB), preheader: s(p.preheader), bodyMd: s(p.bodyMd), keyPoints: arr(p.keyPoints) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
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
