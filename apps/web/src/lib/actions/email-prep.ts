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
  const system = `You are the editor of a NEWSLETTER for a passive-income portfolio - a genuine content issue, NOT an ad. It reads like a useful bulletin one person sends another: industry news, policy or benefit changes, local or timely developments, a practical tip the reader can use even if they never click anything.
STRUCTURE (in this order):
1. Greeting line ("Hey {{first_name|there}},"), then a HOOK - a concrete, newsy claim or open loop on the topic.
2. The BODY is the content: deliver the actual news/insight/tip. This is ~80% of the email and stands on its own value. The reader should feel informed even with no offer.
3. ONE natural bridge, late, to the offer - the offer is a recommendation the news makes relevant (the tool for what you just explained), a soft PS-style line, not the subject of the email.
4. Optional one useful internal link (the brand's own tool) if it fits.
STRICT: English only. Use "-" not em dashes. No AI-tell phrases ("in today's fast-paced world", "unlock", "dive in", "elevate", "moreover", "in conclusion"). Short paragraphs. No hype.
DO NOT FABRICATE specifics: never invent exact statistics, dollar figures, dates, named studies, or events that were not given in the brief. Keep any factual framing true and general; if you lack a verified number, speak in plain general terms instead of making one up.
The subject line is about the NEWS/VALUE, never about the product name.`;
  const user = `Write ONE newsletter issue (content-first) for this audience, with the offer as a natural late recommendation.
Product/brand: ${t.name || ''}${t.website ? ` (${t.website})` : ''} — ${t.one_liner || ''}
Audience: ${audience}${ctx.segment ? ` · segment: ${ctx.segment}` : ''}
Issue topic / news angle: ${t.title || ''}
${t.instructions ? `Source notes / facts to use (only these - do not invent beyond them):\n${t.instructions}` : ''}
OFFER (recommend once, late, as the tool the topic makes relevant): ${offer}. Put the link exactly as "${ctx.offerUrl || '[ offer link ]'}" at that one spot.

Return JSON: {
  "subjectA": "≤60 chars, about the news/value (NOT the product)",
  "subjectB": "≤60 chars, different news angle for A/B",
  "preheader": "≤90 chars inbox preview that extends the subject",
  "bodyMd": "full newsletter body, plain text, blank lines between paragraphs. Greeting then newsy hook. Most of it is the actual content/news; ONE soft offer recommendation late; end with a one-click unsubscribe + physical-address footer placeholder.",
  "keyPoints": ["3 to 5 very short bullets: the news/value beats first, then the single offer mention last"]
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
