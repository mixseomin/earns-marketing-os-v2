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
export function buildContentPrompt(ctx: AiContentCtx, kind: string, extra: string): string {
  const site = (ctx.website || '').replace(/\/$/, '');
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
