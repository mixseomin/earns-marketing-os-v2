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
import { distillDom, getDomGrounding, prepFillFieldsCore, type FillField, type PrepFillOpts, type PrepFillIdentityMeta } from '@/lib/ai/prep-fill-core';

export type { AiContentCtx, FillField, PrepFillOpts, PrepFillIdentityMeta };

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
// Distill raw captured HTML into a compact actionable skeleton — EVERY form field, button, label,
// select-option, heading and actionable link on the page, not just pre-trained selectors. Regex
// best-effort (no HTML parser dep); a missed element just means slightly less grounding. This is the
// answer to "selectors miss undefined things": the whole page's real controls are surfaced here.
export async function normalizeInstructions(taskId: number, opts?: { sampleId?: number | null }): Promise<{ ok: boolean; instructions?: string; error?: string; grounded?: boolean }> {
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  try {
    const rows = await db.execute(sql`SELECT ht.instructions, ht.prep_payload->>'source_url' src, ht.prep_payload->>'mechanism' mech, ht.title, p.one_liner, p.website FROM human_tasks ht LEFT JOIN projects p ON p.id = ht.project_id WHERE ht.id = ${taskId} AND ht.platform_key = 'backlink' LIMIT 1`);
    const r = (rows as unknown as Array<{ instructions: string | null; src: string | null; mech: string | null; title: string | null; one_liner: string | null; website: string | null }>)[0];
    if (!r) return { ok: false, error: 'task not found' };
    const cur = (r.instructions || '').trim();
    if (!cur && !r.mech) return { ok: false, error: 'không có nội dung để chuẩn hoá' };
    const g = await getDomGrounding(db, r.src || '', opts?.sampleId);
    const prompt = `${BACKLINK_INSTRUCTION_TEMPLATE}

--- TASK ---
Title: ${r.title || ''}
Source URL: ${r.src || ''}
Mechanism: ${r.mech || ''}
Sản phẩm (mô tả ĐÚNG theo đây, KHÔNG bịa): ${r.one_liner || '(chưa có one-liner — mô tả trung tính, không suy diễn tính năng)'}
Website (trang chủ THẬT): ${r.website || ''}
Hướng dẫn hiện tại:
${cur || '(trống — dựng từ mechanism + source)'}
${g.block}
--- YÊU CẦU ---
Viết lại hướng dẫn task này theo ĐÚNG khuôn trên. ${g.prov ? 'CÓ "CẤU TRÚC TRANG THẬT" ở trên — dùng đúng tên nút/field/label có thật đó cho các bước, KHÔNG bịa element không có trong cấu trúc.' : ''} Mô tả sản phẩm CHỈ dựa trên one-liner ở trên — KHÔNG bịa tính năng/danh mục (vd đừng gọi một calculator là "immigration tracker" nếu one-liner không nói vậy); nếu hướng dẫn hiện tại mô tả sai sản phẩm thì SỬA LẠI cho khớp one-liner. Mọi link CHỈ dùng URL THẬT: trang chủ (Website ở trên) hoặc URL có trong "CẤU TRÚC TRANG THẬT" — TUYỆT ĐỐI KHÔNG bịa sub-path (vd /visa-bulletin) không có thật. Chỉ xuất phần hướng dẫn (không giải thích, không markdown fence).`;
    const res = await getOpenAI()!.chat.completions.create({ model: DEFAULT_MODEL, temperature: 0.3, messages: [{ role: 'user', content: prompt }] });
    const text = res.choices?.[0]?.message?.content?.trim().replace(/^```[a-z]*\n?|\n?```$/g, '').trim() || '';
    if (!text) return { ok: false, error: 'AI không trả nội dung' };
    // custom_instructions=true → this task is now locally reshaped, so it DETACHES from its catalog
    // source template: a later source edit (syncTasksFromSource) will skip it instead of clobbering
    // this bespoke text. See backlink-catalog.syncTasksFromSource.
    const groundStamp = g.prov
      ? sql`, prep_payload = COALESCE(prep_payload, '{}'::jsonb) || jsonb_build_object('custom_instructions', true, 'grounded', ${JSON.stringify({ at: new Date().toISOString(), host: g.prov.host, source: g.prov.source, sampleId: g.prov.sampleId, sampleAt: g.prov.sampleAt })}::jsonb)`
      : sql`, prep_payload = COALESCE(prep_payload, '{}'::jsonb) || jsonb_build_object('custom_instructions', true)`;
    await db.execute(sql`UPDATE human_tasks SET instructions = ${text}${groundStamp}, updated_at = now() WHERE id = ${taskId} AND platform_key = 'backlink'`);
    return { ok: true, instructions: text, grounded: !!g.prov };
  } catch (e) {
    return { ok: false, error: `chuẩn hoá lỗi: ${(e as Error).message || String(e)}` };
  }
}

// List the captured DOM samples that could ground this task (same host + same registrable domain),
// newest first, with a distilled preview + which one the task is currently grounded on. Powers the
// drawer DOM picker: when already grounded on the latest DOM, ask which DOM to re-normalize against.
export async function listTaskDomSamples(taskId: number): Promise<{ ok: boolean; groundedSampleId?: number | null; samples?: Array<{ id: number; capturedAt: string; title: string; url: string; pageKind: string; fieldCount: number; preview: string }>; error?: string }> {
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const rows = await db.execute(sql`SELECT prep_payload->>'source_url' src, prep_payload->'grounded'->>'sampleId' gid FROM human_tasks WHERE id = ${taskId} AND platform_key = 'backlink' LIMIT 1`);
  const r = (rows as unknown as Array<{ src: string | null; gid: string | null }>)[0];
  if (!r) return { ok: false, error: 'task not found' };
  const host = (r.src || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
  if (!host || !host.includes('.')) return { ok: true, groundedSampleId: null, samples: [] };
  const ds = (await db.execute(sql`SELECT id, title, url, page_kind, captured_at, html FROM dom_samples WHERE hostname = ${host} OR hostname LIKE ${'%.' + host} ORDER BY (hostname = ${host}) DESC, captured_at DESC LIMIT 20`)) as unknown as Array<{ id: number; title: string | null; url: string | null; page_kind: string | null; captured_at: string; html: string | null }>;
  const samples = ds.map((d) => { const skel = distillDom(d.html || ''); return { id: Number(d.id), capturedAt: String(d.captured_at), title: String(d.title || ''), url: String(d.url || ''), pageKind: String(d.page_kind || ''), fieldCount: skel ? skel.split('\n').filter(Boolean).length : 0, preview: skel.slice(0, 700) }; });
  return { ok: true, groundedSampleId: r.gid ? Number(r.gid) : null, samples };
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

// ── ✨ Chuẩn bị điền (prepFillFields) — sibling của Chuẩn hoá. Chuẩn hoá = viết lại HƯỚNG DẪN (prose cho
//    người); prep-fill = sinh GIÁ TRỊ TỪNG FIELD (form thật) để ext auto-fill. Lõi ở prep-fill-core (dùng
//    CHUNG với ext route token-authed); wrapper này chỉ thêm admin cookie auth. Identity KHÔNG bịa — xem core.
// opts.resolvedAccountId = account drawer đang hiển thị · recommendedRole = role platform · pinnedIdentityId =
// identity user CHỌN TAY (override auto role).
export async function prepFillFields(taskId: number, opts?: PrepFillOpts): Promise<{ ok: boolean; fields?: FillField[]; error?: string; grounded?: boolean; needAccount?: boolean; identity?: PrepFillIdentityMeta }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  return prepFillFieldsCore(db, taskId, opts);
}

export async function deleteAiContent(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`DELETE FROM ai_content WHERE id = ${id}`);
  return { ok: true };
}
