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
import { BACKLINK_INSTRUCTION_TEMPLATE } from '@/lib/backlink-instruction-template';
import { getCurrentUser } from '@/lib/auth';
import { buildContentPrompt, type AiContentCtx } from '@/lib/ai/backlink-content-prompt';

export type { AiContentCtx };

async function requireAdmin(): Promise<boolean> {
  const me = await getCurrentUser();
  return me?.role === 'admin';
}

export interface AiContentRow {
  id: number; kind: string; engine: string; status: string;
  result: string | null; error: string | null; createdAt: string; doneAt: string | null;
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

// Reformat one backlink task's instructions into the canonical template (drawer "✨ Chuẩn hoá").
// Reshape + translate + fill missing meta lines; never invent steps/conditions not in the source.
export async function normalizeInstructions(taskId: number): Promise<{ ok: boolean; instructions?: string; error?: string }> {
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  try {
    const rows = await db.execute(sql`SELECT instructions, prep_payload->>'source_url' src, prep_payload->>'mechanism' mech, title FROM human_tasks WHERE id = ${taskId} AND platform_key = 'backlink' LIMIT 1`);
    const r = (rows as unknown as Array<{ instructions: string | null; src: string | null; mech: string | null; title: string | null }>)[0];
    if (!r) return { ok: false, error: 'task not found' };
    const cur = (r.instructions || '').trim();
    if (!cur && !r.mech) return { ok: false, error: 'không có nội dung để chuẩn hoá' };
    const prompt = `${BACKLINK_INSTRUCTION_TEMPLATE}

--- TASK ---
Title: ${r.title || ''}
Source URL: ${r.src || ''}
Mechanism: ${r.mech || ''}
Hướng dẫn hiện tại:
${cur || '(trống — dựng từ mechanism + source)'}

--- YÊU CẦU ---
Viết lại hướng dẫn task này theo ĐÚNG khuôn trên. Chỉ xuất phần hướng dẫn (không giải thích, không markdown fence).`;
    const res = await getOpenAI()!.chat.completions.create({ model: DEFAULT_MODEL, temperature: 0.3, messages: [{ role: 'user', content: prompt }] });
    const text = res.choices?.[0]?.message?.content?.trim().replace(/^```[a-z]*\n?|\n?```$/g, '').trim() || '';
    if (!text) return { ok: false, error: 'AI không trả nội dung' };
    await db.execute(sql`UPDATE human_tasks SET instructions = ${text}, updated_at = now() WHERE id = ${taskId} AND platform_key = 'backlink'`);
    return { ok: true, instructions: text };
  } catch (e) {
    return { ok: false, error: `chuẩn hoá lỗi: ${(e as Error).message || String(e)}` };
  }
}

// Bulk-reshape a project's genuinely non-conforming backlink instructions to the template. Targets
// only tasks with NEITHER the 📍 line NOR numbered steps (the truly-thin ones) — a single-mechanism
// task that already has the 📍/meta lines is correct as-is and left alone (never invents fake steps).
// Content-preserving reshape via normalizeInstructions (OpenAI), one task at a time.
export async function normalizeProjectInstructions(projectId: string): Promise<{ ok: boolean; done: number; failed: number; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, done: 0, failed: 0, error: 'no db' };
  if (!aiEnabled()) return { ok: false, done: 0, failed: 0, error: 'OPENAI_API_KEY chưa cấu hình' };
  if (!/^[a-z0-9_-]+$/i.test(projectId)) return { ok: false, done: 0, failed: 0, error: 'projectId không hợp lệ' };
  try {
    const rows = await db.execute(sql`
      SELECT id FROM human_tasks
      WHERE platform_key = 'backlink' AND prep_payload->'site_status' ? ${projectId}
        AND instructions NOT LIKE '%📍%' AND instructions !~ '[0-9]\\. '
        AND instructions NOT LIKE '%ĐÃ CHUYỂN%' AND COALESCE(length(instructions), 0) > 0`);
    const ids = (rows as unknown as Array<{ id: number }>).map((r) => Number(r.id));
    let done = 0, failed = 0;
    for (const id of ids) {
      const r = await normalizeInstructions(id);
      if (r.ok) done++; else failed++;
    }
    return { ok: true, done, failed };
  } catch (e) {
    return { ok: false, done: 0, failed: 0, error: (e as Error).message || String(e) };
  }
}

export async function deleteAiContent(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`DELETE FROM ai_content WHERE id = ${id}`);
  return { ok: true };
}
