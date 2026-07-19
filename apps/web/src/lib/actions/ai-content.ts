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
// Distill raw captured HTML into a compact actionable skeleton — EVERY form field, button, label,
// select-option, heading and actionable link on the page, not just pre-trained selectors. Regex
// best-effort (no HTML parser dep); a missed element just means slightly less grounding. This is the
// answer to "selectors miss undefined things": the whole page's real controls are surfaced here.
function distillDom(html: string): string {
  if (!html) return '';
  const h = html.slice(0, 500_000);
  const clean = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  const attr = (tag: string, name: string) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')); return m?.[1]?.trim() ?? ''; };
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (line: string) => { const k = line.toLowerCase(); if (line && !seen.has(k)) { seen.add(k); out.push(line); } };
  for (const m of h.matchAll(/<(input|textarea)\b([^>]*)>/gi)) {
    const tag = m[2] ?? '';
    const type = attr(tag, 'type') || ((m[1] ?? '').toLowerCase() === 'textarea' ? 'textarea' : 'text');
    if (/^hidden$/i.test(type)) continue;
    const bits = [attr(tag, 'name'), attr(tag, 'id'), attr(tag, 'placeholder'), attr(tag, 'aria-label')].filter(Boolean);
    if (bits.length) push(`input[${type}] ${bits.join(' · ')}`.slice(0, 130));
  }
  for (const m of h.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const name = attr(m[1] ?? '', 'name') || attr(m[1] ?? '', 'id');
    const opts = [...(m[2] ?? '').matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)].map((o) => clean(o[1] ?? '')).filter(Boolean).slice(0, 8);
    if (name || opts.length) push(`select ${name}${opts.length ? ` [${opts.join(', ')}]` : ''}`.slice(0, 170));
  }
  for (const m of h.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) { const t = clean(m[1] ?? ''); if (t) push(`button "${t}"`); }
  for (const m of h.matchAll(/<input\b[^>]*\btype\s*=\s*["']?(?:submit|button)["']?[^>]*>/gi)) { const v = attr(m[0] ?? '', 'value'); if (v) push(`button "${v}"`); }
  for (const m of h.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)) { const t = clean(m[1] ?? ''); if (t) push(`label "${t}"`); }
  const ACT = /\b(submit|add|new|create|post|publish|launch|suggest|contribute|sign\s?up|sign\s?in|log\s?in|register|write|start|apply|compose|ask|share|upload)\b/i;
  for (const m of h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) { const t = clean(m[2] ?? ''); if (t && ACT.test(t)) push(`link "${t}" → ${attr(m[1] ?? '', 'href').slice(0, 60)}`); }
  for (const m of h.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)) { const t = clean(m[1] ?? ''); if (t) push(`heading "${t}"`); }
  return out.slice(0, 90).join('\n');
}

// Assemble a grounding block for a source URL from real captured data (dom_samples distilled skeleton
// + verified selector_overrides). Returns the block + provenance (for the task's `grounded` marker).
async function getDomGrounding(db: NonNullable<ReturnType<typeof getDb>>, sourceUrl: string): Promise<{ block: string; prov: { host: string; source: string; sampleId: number | null; sampleAt: string | null } | null }> {
  const host = (sourceUrl || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
  if (!host || !host.includes('.')) return { block: '', prov: null };
  const doms = (await db.execute(sql`SELECT id, platform_key, page_kind, title, html, captured_at FROM dom_samples WHERE hostname = ${host} ORDER BY captured_at DESC`)) as unknown as Array<{ id: number; platform_key: string | null; page_kind: string | null; title: string | null; html: string | null; captured_at: string }>;
  const platformKey = doms.find((d) => d.platform_key)?.platform_key ?? null;
  let sels: Array<{ page_kind: string; field_name: string; spec: string }> = [];
  if (platformKey) sels = (await db.execute(sql`SELECT page_kind, field_name, spec::text AS spec FROM selector_overrides WHERE scope_key = ${platformKey} ORDER BY page_kind, field_name LIMIT 60`)) as unknown as typeof sels;
  if (!doms.length && !sels.length) return { block: '', prov: null };
  const parts = ['\n--- CẤU TRÚC TRANG THẬT (đã capture — viết bước ĐÚNG với site, KHÔNG bịa nút/field) ---', `Host: ${host}`];
  const byKind = new Map<string, typeof doms[number]>();
  for (const d of doms) { const k = d.page_kind || 'page'; if (!byKind.has(k)) byKind.set(k, d); }
  for (const [kind, d] of byKind) {
    const skel = distillDom(d.html || '');
    if (skel) parts.push(`\n[trang: ${kind}]${d.title ? ` "${String(d.title).slice(0, 70)}"` : ''}\n${skel}`);
  }
  if (sels.length) parts.push('\n[selector đã verify]\n' + sels.map((s) => { let css = s.spec; try { const j = JSON.parse(s.spec) as { css?: string; notes?: string }; css = (j.css || s.spec) + (j.notes ? ` — ${j.notes}` : ''); } catch { /* raw */ } return `- ${s.field_name}: ${css}`; }).join('\n'));
  parts.push('--- HẾT ---\nƯu tiên nhắc đúng tên nút/field/label CÓ trong cấu trúc trên khi viết "Các bước".');
  const source = byKind.size && sels.length ? 'dom+selectors' : byKind.size ? 'dom' : 'selectors';
  return { block: parts.join('\n'), prov: { host, source, sampleId: doms[0]?.id ?? null, sampleAt: doms[0]?.captured_at ?? null } };
}

export async function normalizeInstructions(taskId: number): Promise<{ ok: boolean; instructions?: string; error?: string; grounded?: boolean }> {
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  try {
    const rows = await db.execute(sql`SELECT instructions, prep_payload->>'source_url' src, prep_payload->>'mechanism' mech, title FROM human_tasks WHERE id = ${taskId} AND platform_key = 'backlink' LIMIT 1`);
    const r = (rows as unknown as Array<{ instructions: string | null; src: string | null; mech: string | null; title: string | null }>)[0];
    if (!r) return { ok: false, error: 'task not found' };
    const cur = (r.instructions || '').trim();
    if (!cur && !r.mech) return { ok: false, error: 'không có nội dung để chuẩn hoá' };
    const g = await getDomGrounding(db, r.src || '');
    const prompt = `${BACKLINK_INSTRUCTION_TEMPLATE}

--- TASK ---
Title: ${r.title || ''}
Source URL: ${r.src || ''}
Mechanism: ${r.mech || ''}
Hướng dẫn hiện tại:
${cur || '(trống — dựng từ mechanism + source)'}
${g.block}
--- YÊU CẦU ---
Viết lại hướng dẫn task này theo ĐÚNG khuôn trên. ${g.prov ? 'CÓ "CẤU TRÚC TRANG THẬT" ở trên — dùng đúng tên nút/field/label có thật đó cho các bước, KHÔNG bịa element không có trong cấu trúc.' : ''} Chỉ xuất phần hướng dẫn (không giải thích, không markdown fence).`;
    const res = await getOpenAI()!.chat.completions.create({ model: DEFAULT_MODEL, temperature: 0.3, messages: [{ role: 'user', content: prompt }] });
    const text = res.choices?.[0]?.message?.content?.trim().replace(/^```[a-z]*\n?|\n?```$/g, '').trim() || '';
    if (!text) return { ok: false, error: 'AI không trả nội dung' };
    const groundStamp = g.prov
      ? sql`, prep_payload = COALESCE(prep_payload, '{}'::jsonb) || jsonb_build_object('grounded', ${JSON.stringify({ at: new Date().toISOString(), host: g.prov.host, source: g.prov.source, sampleId: g.prov.sampleId, sampleAt: g.prov.sampleAt })}::jsonb)`
      : sql``;
    await db.execute(sql`UPDATE human_tasks SET instructions = ${text}${groundStamp}, updated_at = now() WHERE id = ${taskId} AND platform_key = 'backlink'`);
    return { ok: true, instructions: text, grounded: !!g.prov };
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
