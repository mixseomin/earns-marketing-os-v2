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

// AI-write the real email (subject A/B + preheader + body) from the card brief + offer + audience.
// English, human-voice (public content). Returns fields the drawer merges into the draft.
export async function generateEmailPrep(
  taskId: number,
  ctx: { offerLabel?: string; segment?: string; audience?: string },
): Promise<{ ok: boolean; subjectA?: string; subjectB?: string; preheader?: string; bodyMd?: string; error?: string }> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return { ok: false, error: 'admin-only' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
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
  const system = `You are an email copywriter for a passive-income marketing portfolio. Write natural, human copy that sounds like one person emailing another. STRICT: English only. Use "-" not em dashes. No AI-tell phrases ("in today's fast-paced world", "unlock", "dive in", "elevate", "moreover"). Short paragraphs. Concrete, value-first, one soft CTA. Avoid hype.`;
  const user = `Write ONE newsletter email.
Product/brand: ${t.name || ''}${t.website ? ` (${t.website})` : ''} — ${t.one_liner || ''}
Audience: ${audience}${ctx.segment ? ` · segment: ${ctx.segment}` : ''}
Theme / brief: ${t.title || ''}
${t.instructions ? `Notes/outline:\n${t.instructions}` : ''}
${ctx.offerLabel ? `Soft-promote this offer naturally (content-first, the offer is the tool that solves the pain): ${ctx.offerLabel}. Use a placeholder "[ offer link ]" where the link goes.` : ''}

Return JSON: { "subjectA": "≤60 chars, curiosity/benefit", "subjectB": "≤60 chars, alt angle for A/B", "preheader": "≤90 chars inbox preview", "bodyMd": "full email body, plain text with blank lines between paragraphs; include a one-click unsubscribe + physical-address footer placeholder" }`;

  try {
    const res = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1400,
    });
    logAiUsage('email-prep', DEFAULT_MODEL, res.usage, t.project_id);
    const p = JSON.parse(res.choices[0]?.message?.content ?? '{}') as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    return { ok: true, subjectA: s(p.subjectA), subjectB: s(p.subjectB), preheader: s(p.preheader), bodyMd: s(p.bodyMd) };
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
