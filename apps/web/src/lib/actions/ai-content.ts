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
import { classifyFillField, resolveIdentityFill, blockNeedsIdentity, type PrepIdentity } from '@/lib/ai/prep-fill';

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

// ── ✨ Chuẩn bị điền (prepFillFields) — sibling của Chuẩn hoá. Chuẩn hoá = viết lại HƯỚNG DẪN (prose cho
//    người); prep-fill = sinh GIÁ TRỊ TỪNG FIELD (form thật) để ext auto-fill. Dùng CHUNG getDomGrounding
//    (đã distill mọi field) + account/persona + brand.
//    NGUYÊN TẮC (2026-07-19): identity KHÔNG BAO GIỜ bịa. Field identity (name/username/email/password/
//    phone/dob…) điền DETERMINISTIC từ account THẬT đã resolve; account thiếu field → NEED:<x> (value rỗng),
//    KHÔNG có account mà form cần identity → BLOCKER (không gọi LLM bịa "John Doe"). LLM chỉ lo CONTENT
//    (message/subject/unknown). Password KHÔNG nhét vào jsonb (secret-safe) → source 'account-password', ext
//    điền từ creds an toàn. Xem feedback_secret_fields_security + user demand 2026-07-19.
export interface FillField { key: string; label: string; type: string; value: string; source: string; confidence: 'high' | 'med' | 'low' }

// resolvedAccountId = account drawer ĐANG hiển thị (override account_id → pickBest platformKey). Truyền vào để
// prep-fill dùng ĐÚNG account đó, không lệch. Bỏ trống → fallback ht.account_id.
export async function prepFillFields(taskId: number, resolvedAccountId?: number | null): Promise<{ ok: boolean; fields?: FillField[]; error?: string; grounded?: boolean; needAccount?: boolean }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  try {
    const rows = await db.execute(sql`
      SELECT ht.title, ht.instructions, ht.project_id, ht.account_id,
             ht.prep_payload->>'source_url' src, ht.prep_payload->>'mechanism' mech,
             ht.prep_payload->>'target_url' target, ht.prep_payload->>'draft' draft,
             p.name pname, p.website psite, p.one_liner oneliner
      FROM human_tasks ht LEFT JOIN projects p ON p.id = ht.project_id
      WHERE ht.id = ${taskId} AND ht.platform_key = 'backlink' LIMIT 1`);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!r) return { ok: false, error: 'task not found' };
    // DOM grounding = danh sách field THẬT (distillDom). Chưa lưu DOM → chưa prep được (cần 💾 Lưu DOM ở ext).
    const g = await getDomGrounding(db, String(r.src || ''));
    if (!g.block) return { ok: false, error: 'chưa có DOM đã lưu cho site này — bấm 💾 Lưu DOM trong ext trước' };
    // ── Account THẬT: drawer resolved > ht.account_id. Load FULL identity (persona + custom_fields + có pwd?).
    const accountId = (resolvedAccountId != null ? Number(resolvedAccountId) : null) ?? (r.account_id != null ? Number(r.account_id) : null);
    let acct: PrepIdentity | null = null;
    if (accountId != null) {
      const ar = await db.execute(sql`SELECT handle, email, persona, custom_fields, (password_enc IS NOT NULL) AS has_pw FROM platform_accounts WHERE id = ${accountId} LIMIT 1`);
      const a = (ar as unknown as Array<Record<string, unknown>>)[0];
      if (a) {
        const pj = (a.persona && typeof a.persona === 'object') ? a.persona as Record<string, unknown> : {};
        acct = {
          handle: String(a.handle || ''), email: String(a.email || ''),
          personaName: String(pj.name || pj.displayName || pj.fullName || pj.full_name || ''),
          persona: pj, custom: (a.custom_fields && typeof a.custom_fields === 'object') ? a.custom_fields as Record<string, unknown> : {},
          hasPassword: a.has_pw === true,
        };
      }
    }
    // KHÔNG có account mà form cần identity (name/email/username/password…) → BLOCKER, tuyệt đối KHÔNG bịa.
    if (!acct && blockNeedsIdentity(g.block)) {
      return { ok: false, needAccount: true, error: 'Task chưa gán account/persona thật (form cần tên + email thật để điền). Gán account ở drawer rồi bấm lại — hoặc dùng RegKit tạo account nếu task cần đăng ký.' };
    }
    const target = String(r.target || r.psite || '').replace(/\/$/, '');
    // LLM CHỈ lo CONTENT (message/subject/unknown) + phát hiện key field thật. Identity điền deterministic ở dưới.
    const prompt = `Bạn CHUẨN BỊ giá trị điền cho FORM trên trang đặt backlink. Dựa vào CẤU TRÚC TRANG THẬT (field đã capture), liệt kê MỖI field điền được (input/textarea/select) — KHÔNG button/link/heading.

CONTEXT:
- Sản phẩm: ${r.pname || ''}${r.psite ? ` (${String(r.psite).replace(/\/$/, '')})` : ''}
- Link đích cần đặt (backlink): ${target || '(dùng website sản phẩm)'}
${r.oneliner ? `- Sản phẩm làm gì: ${r.oneliner}\n` : ''}- Cách đặt: ${r.mech || ''}
- Ghi chú task (tiếng Việt, tuân theo): ${String(r.instructions || '').slice(0, 1200)}
- Pitch/bài chuẩn bị sẵn (nếu có): ${String(r.draft || '(chưa có)').slice(0, 1500)}
${g.block}
--- YÊU CẦU ---
Với MỖI field điền được, xuất 1 object JSON: {"key","label","type","value","source","confidence"}.
- key = name/id THẬT của field trong cấu trúc; label = nhãn người đọc; type = loại (text/email/textarea/select…).
- value (CÔNG KHAI = ENGLISH ONLY) — QUAN TRỌNG: field DANH TÍNH cá nhân (name/họ/tên/first/last/full name/username/user id/login/handle/alias/nickname/email/password/phone/dob/gender/địa chỉ/company) LUÔN để value="" — hệ thống tự điền từ account THẬT, BẠN TUYỆT ĐỐI KHÔNG bịa tên/username/email/số. Nếu KHÔNG chắc 1 field có phải danh tính cá nhân không → CŨNG để value="". Chỉ sinh value cho:
  * website/url/link → để "" (hệ thống điền link đích).
  * message/comment/body/textarea → pitch tự nhiên giới thiệu ${r.pname || 'sản phẩm'}, gài link 1 lần nếu field mang link; dùng pitch sẵn nếu có. Human voice, no em dash.
  * subject/tiêu đề → 1 subject ngắn, cụ thể.
  * select → chọn option HỢP LÝ NHẤT từ danh sách trong cấu trúc; không chắc → confidence="low".
  * field không rõ (vd "how did you hear about us") → best guess NGẮN + confidence="low".
- confidence: high | med | low.
CHỈ trả JSON array, KHÔNG markdown fence, KHÔNG giải thích.`;
    const res = await getOpenAI()!.chat.completions.create({ model: DEFAULT_MODEL, temperature: 0.3, messages: [{ role: 'user', content: prompt }] });
    const raw = res.choices?.[0]?.message?.content?.trim().replace(/^```[a-z]*\n?|\n?```$/g, '').trim() || '';
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\[[\s\S]*\]/); if (!m) return { ok: false, error: 'AI trả không phải JSON' }; try { parsed = JSON.parse(m[0]); } catch { return { ok: false, error: 'JSON lỗi cú pháp' }; } }
    if (!Array.isArray(parsed)) return { ok: false, error: 'AI không trả mảng field' };
    const items: FillField[] = parsed.slice(0, 40).map((x): FillField => {
      const o = (x && typeof x === 'object') ? x as Record<string, unknown> : {};
      const key = String(o.key || o.name || '').slice(0, 120);
      const label = String(o.label || o.key || '').slice(0, 160);
      const type = String(o.type || 'text').slice(0, 24);
      const conf = String(o.confidence || 'med').toLowerCase();
      const base: FillField = {
        key, label, type,
        value: String(o.value == null ? '' : o.value).slice(0, 4000),
        source: String(o.source || '').slice(0, 60),
        confidence: ((conf === 'high' || conf === 'low') ? conf : 'med') as FillField['confidence'],
      };
      // POST-PROCESS (bảo chứng KHÔNG bịa): identity → deterministic từ account; website → link đích; content giữ LLM.
      const kind = classifyFillField(key, label, type);
      const idf = resolveIdentityFill(kind, key, label, acct);
      if (idf) return { ...base, value: idf.value, source: idf.source, confidence: idf.confidence };
      if (kind === 'website') return { ...base, value: target || String(r.psite || '').replace(/\/$/, ''), source: 'target-url', confidence: 'high' };
      return { ...base, source: base.source || 'ai-content' };
    }).filter((f) => f.key || f.label);
    if (!items.length) return { ok: false, error: 'không sinh được field nào' };
    const payload = { at: new Date().toISOString(), accountId, items };
    await db.execute(sql`UPDATE human_tasks SET prep_payload = COALESCE(prep_payload, '{}'::jsonb) || jsonb_build_object('fill_fields', ${JSON.stringify(payload)}::jsonb), updated_at = now() WHERE id = ${taskId} AND platform_key = 'backlink'`);
    return { ok: true, fields: items, grounded: !!g.prov };
  } catch (e) {
    return { ok: false, error: `chuẩn bị điền lỗi: ${(e as Error).message || String(e)}` };
  }
}

export async function deleteAiContent(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`DELETE FROM ai_content WHERE id = ${id}`);
  return { ok: true };
}
