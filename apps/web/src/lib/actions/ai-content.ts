'use server';

// AI content pieces for backlink tasks. Two engines:
//  - 'openai': generated inline (gpt), stored status=done immediately.
//  - 'claude': QUEUED (status=queued) — fulfilled when a Claude chat session services the
//    queue (reads pending rows, writes result, marks done). Higher quality, no API cost.
// Every request stores the full built prompt + a context snapshot so any later session can
// fulfill it without re-deriving. "Combine all context" happens in buildContentPrompt.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { getOpenAI, aiEnabled, DEFAULT_MODEL } from '@/lib/ai/openai';
import { getCurrentUser } from '@/lib/auth';

async function requireAdmin(): Promise<boolean> {
  const me = await getCurrentUser();
  return me?.role === 'admin';
}

export interface AiContentCtx {
  projectName: string; website?: string; oneLiner?: string; bio?: string;
  platformLabel?: string; mechanism?: string; instructions?: string;
}
export interface AiContentRow {
  id: number; kind: string; engine: string; status: string;
  result: string | null; error: string | null; createdAt: string; doneAt: string | null;
}

// The single place that fuses every requirement + context into one brief. Used for both
// engines so OpenAI-now and Claude-queued get the identical, fully-contextual prompt.
// NOT exported: a 'use server' module may only export async functions.
function buildContentPrompt(ctx: AiContentCtx, kind: string, extra: string): string {
  const site = (ctx.website || '').replace(/\/$/, '');
  // Email/outreach genre: resource-page & editorial-pitch tasks need a real email to a
  // site owner/librarian, not an "off-site post". Detected from the requested piece.
  if (/\b(email|outreach|pitch)\b/i.test(kind)) {
    const followUp = /\b(follow-?up|nudge|reminder|remind)\b/i.test(kind);
    return [
      followUp
        ? `Write ONE short, friendly FOLLOW-UP email nudging the owner/editor/librarian about an earlier email you already sent suggesting our free tool for their resource list. They have not replied yet. Output ENGLISH only.`
        : `Write ONE outreach email to the owner/editor/librarian of an external resource page, asking them to add our free tool to their list of resources. Output ENGLISH only.`,
      extra ? `EXTRA REQUIREMENTS: ${extra}` : '',
      ``,
      `PRODUCT: ${ctx.projectName}${site ? ` (${site})` : ''}`,
      ctx.oneLiner ? `WHAT IT DOES: ${ctx.oneLiner}` : '',
      ctx.platformLabel ? `RECIPIENT SITE / PAGE: ${ctx.platformLabel}` : '',
      ctx.mechanism ? `WHERE/WHY IT FITS: ${ctx.mechanism}` : '',
      ctx.instructions ? `TASK NOTES (internal, Vietnamese — obey them):\n${ctx.instructions}` : '',
      ``,
      `RULES:`,
      `- Format EXACTLY: first line "Subject: <short specific subject>", then a blank line, then the body.`,
      followUp
        ? `- Body = 2-3 short sentences ONLY: lightly reference your earlier note, a one-line reminder of the free tool + its value, a soft ask if they would consider adding it. Do NOT re-pitch in full or paste the whole description again. Sign off with a generic first name.`
        : `- Body = 4-7 short sentences: a warm greeting, note that you came across their specific page/resource, introduce the free tool in one line, one sentence on why it genuinely helps their audience (students / veterans / retirees / applicants as relevant), state it is free with no signup, offer the link${site ? ` (${site})` : ''}, thank them. Sign off with a generic first name.`,
      `- Human and specific: reference something concrete about their page if the notes name it. No "I hope this email finds you well", no marketing fluff, no em dashes (use "-"), vary sentence length.`,
      `- Do NOT mention SEO, backlinks, or link building. This is a genuine resource suggestion.`,
      `Return ONLY the email (Subject line + body), no preamble, no explanation.`,
    ].filter((l) => l !== '').join('\n');
  }
  return [
    `Produce ONE ready-to-post piece of content for an off-site backlink placement. Output ENGLISH only.`,
    ``,
    `WHAT TO PRODUCE: ${kind}`,
    extra ? `EXTRA REQUIREMENTS: ${extra}` : '',
    ``,
    `PRODUCT: ${ctx.projectName}${site ? ` (${site})` : ''}`,
    ctx.oneLiner ? `ONE-LINER: ${ctx.oneLiner}` : '',
    ctx.bio ? `BIO: ${ctx.bio}` : '',
    ctx.platformLabel ? `PLATFORM: ${ctx.platformLabel}` : '',
    ctx.mechanism ? `MECHANISM: ${ctx.mechanism}` : '',
    ctx.instructions ? `FULL BUILD INSTRUCTIONS (internal, Vietnamese — obey them):\n${ctx.instructions}` : '',
    ``,
    `RULES:`,
    `- Match the platform's norms and the specific piece requested (a title is short; a comment is conversational; a bio is tight; an answer is helpful and specific).`,
    `- Human voice: no em dashes (use "-"), no "in today's fast-paced world", no "delve", vary sentence length, sound like a real practitioner.`,
    site ? `- If (and only if) this piece should carry the link, reference ${ctx.projectName} and include ${site} naturally, once. Do not spam the URL.` : '',
    `- Do not mention that this is for a backlink or SEO.`,
    `Return ONLY the content, no preamble, no explanation.`,
  ].filter((l) => l !== '').join('\n');
}

export async function listAiContent(taskId: number): Promise<AiContentRow[]> {
  const db = getDb(); if (!db) return [];
  const r = await db.execute(sql`SELECT id, kind, engine, status, result, error, created_at, done_at FROM ai_content WHERE task_id = ${taskId} ORDER BY created_at DESC`);
  return (r as unknown as Array<Record<string, unknown>>).map((x) => ({
    id: Number(x.id), kind: String(x.kind), engine: String(x.engine), status: String(x.status),
    result: (x.result as string | null) ?? null, error: (x.error as string | null) ?? null,
    createdAt: x.created_at instanceof Date ? x.created_at.toISOString() : String(x.created_at ?? ''),
    doneAt: x.done_at instanceof Date ? x.done_at.toISOString() : (x.done_at as string | null) ?? null,
  }));
}

export async function generateAiContent(input: {
  taskId: number; projectId: string; site: string; kind: string; extra?: string;
  engine: 'openai' | 'claude'; ctx: AiContentCtx;
}): Promise<{ ok: boolean; id?: number; status?: string; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const kind = (input.kind || '').trim();
  if (!kind) return { ok: false, error: 'chưa nhập cần sinh gì' };
  const prompt = buildContentPrompt(input.ctx, kind, (input.extra || '').trim());
  const ctxJson = JSON.stringify(input.ctx);

  if (input.engine === 'claude') {
    // Queue only — a Claude chat session fulfills it later.
    const ins = await db.execute(sql`
      INSERT INTO ai_content (task_id, project_id, site, kind, engine, status, prompt, context)
      VALUES (${input.taskId}, ${input.projectId}, ${input.site}, ${kind}, 'claude', 'queued', ${prompt}, ${ctxJson}::jsonb)
      RETURNING id`);
    const id = Number((ins as unknown as Array<{ id: number }>)[0]?.id);
    return { ok: true, id, status: 'queued' };
  }

  // OpenAI: generate now.
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  try {
    const res = await getOpenAI()!.chat.completions.create({ model: DEFAULT_MODEL, temperature: 0.7, messages: [{ role: 'user', content: prompt }] });
    const text = res.choices?.[0]?.message?.content?.trim().replace(/^```[a-z]*\n?|\n?```$/g, '').trim() || '';
    if (!text) return { ok: false, error: 'AI không trả nội dung' };
    const ins = await db.execute(sql`
      INSERT INTO ai_content (task_id, project_id, site, kind, engine, status, prompt, context, result, done_at)
      VALUES (${input.taskId}, ${input.projectId}, ${input.site}, ${kind}, 'openai', 'done', ${prompt}, ${ctxJson}::jsonb, ${text}, now())
      RETURNING id`);
    const id = Number((ins as unknown as Array<{ id: number }>)[0]?.id);
    return { ok: true, id, status: 'done' };
  } catch (e) {
    return { ok: false, error: `gen lỗi: ${(e as Error).message || String(e)}` };
  }
}

export async function deleteAiContent(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`DELETE FROM ai_content WHERE id = ${id}`);
  return { ok: true };
}
