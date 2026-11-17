// MỘT CỔNG AI (anh 16/11/2026: "Spy đang có chuỗi fallback hoàn chỉnh, hãy sử dụng nó làm chuẩn để có 1 nguồn dùng API duy nhất cho mọi model").
// Mọi lượt gọi mô hình chữ / đọc ảnh trong repo này đi qua đây → cổng chung spy POST /api/ai (spy-on-tc/server/cong-ai.mjs). Chuỗi tuyến, khoá nhà cung cấp,
// sổ chi ai_luot đều nằm ở spy — nơi gọi KHÔNG giữ khoá, KHÔNG chọn tuyến. Hook ~/.claude/hooks/mot-cong-ai.py chặn mã gọi thẳng nhà cung cấp.
// Trên box3: http://127.0.0.1:3850/api/ai, khoá CONG_AI_KEY đọc từ /root/.secrets/spy.env. Máy khác: https://spy.on.tc/api/ai, khoá env CONG_AI_KEY
// hoặc ~/.secrets/cong-ai.env (dòng CONG_AI_KEY=…).
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const SPY_ENV = '/root/.secrets/spy.env';
const docKhoa = (tep) => { try { return readFileSync(tep, 'utf8').match(/^CONG_AI_KEY=(.*)$/m)?.[1]?.replace(/["']/g, '').trim() || null; } catch { return null; } };
export const congUrl = () => process.env.CONG_AI_URL || (existsSync(SPY_ENV) ? 'http://127.0.0.1:3850/api/ai' : 'https://spy.on.tc/api/ai');
export const congKhoa = () => process.env.CONG_AI_KEY || docKhoa(SPY_ENV) || docKhoa(`${homedir()}/.secrets/cong-ai.env`);

/** Tên mô hình theo bảng spy (GIA_MODEL / tuyenCua): dòng Haiku / Sonnet / Opus / GPT-6 Luna. Nơi gọi nói DÒNG, cổng lo tuyến. */
export const MO_HINH = { haiku: 'claude-haiku-5-5', sonnet: 'fal:anthropic/claude-sonnet-5.5', opus: 'fal:anthropic/claude-opus-5.5', luna: 'fal:openai/gpt-6-luna' };   // tên theo bảng spy: chuỗi có tuyến fal trước chính hãng
/** đổi tên mô hình kiểu cũ (claude-sonnet-4-x, anthropic:…, fal:anthropic/…, openai:gpt-4o-mini…) về dòng của cổng */
export function dongCua(model) {
  const m = String(model || '').toLowerCase();
  if (/opus/.test(m)) return MO_HINH.opus;
  if (/sonnet|gpt-4o(?!-mini)|gpt-5|gemini.*pro/.test(m)) return MO_HINH.sonnet;
  if (/luna|gpt-6/.test(m)) return MO_HINH.luna;
  return MO_HINH.haiku;
}

/**
 * Gọi mô hình qua cổng chung. Trả { kq, model, vao, ra, chi_usd } — kq là đối tượng khi có schema, chữ khi không. Lỗi → ném Error (mọi tuyến hỏng / cấm).
 * kiem(kq, model) trả câu lỗi → lượt sau bỏ tuyến đó (bo_tuyen), tối đa lan lượt.
 */
export async function goiAi(o, { kiem = null, lan = 4, hanMs = 15 * 60e3 } = {}) {
  const khoa = congKhoa(); if (!khoa) throw new Error('thiếu CONG_AI_KEY (box3: /root/.secrets/spy.env · máy khác: ~/.secrets/cong-ai.env)');
  const bo = [...(o.bo_tuyen || [])]; let loi = '';
  for (let i = 0; i < lan; i++) {
    const r = await fetch(congUrl(), { method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json' },
      body: JSON.stringify({ bo_chinh_hang: true, ...o, model: o.model || MO_HINH.haiku, bo_tuyen: bo }), signal: AbortSignal.timeout(hanMs) });   // mặc định KHÔNG về chính hãng — một chỗ đổi
    const j = await r.json().catch(() => ({ loi: `cổng AI trả HTTP ${r.status} không phải JSON` }));
    if (!r.ok || j.loi) throw new Error(`cổng AI: ${j.loi || `HTTP ${r.status}`}`);
    const k = kiem ? kiem(j.kq, j.model) : null;
    if (!k) return j;
    loi = `${j.model}: ${k}`; bo.push(j.model);
  }
  throw new Error(`cổng AI: kết quả sai sau ${lan} tuyến — ${loi}`);
}

/** chữ thuần: system + một câu hỏi → chuỗi */
export async function hoiChu({ viec, model, system, user, max_tokens = 1000, chi_re = false }) {
  const r = await goiAi({ viec, model: dongCua(model), system, noi_dung: user, max_tokens, chi_re });
  return { chu: String(r.kq || ''), model: r.model, vao: r.vao, ra: r.ra, chi_usd: r.chi_usd };
}

/** khối JSON trong chữ trả về (bỏ ```json bọc ngoài, chữ thừa trước / sau) */
const layJson = (t) => { const a = t.indexOf('{'), b = t.lastIndexOf('}'); return a >= 0 && b > a ? t.slice(a, b + 1) : t; };
/** phần nội dung khuôn OpenAI (text / image_url) → khối khuôn Anthropic cổng nhận */
const khoiCong = (x) => {
  if (x?.type !== 'image_url') return { type: 'text', text: String(x?.text ?? '') };
  const u = String(x.image_url?.url ?? x.image_url ?? '');
  const m = u.match(/^data:([^;]+);base64,(.*)$/s);
  return m ? { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } } : { type: 'image', source: { type: 'url', url: u } };
};

/**
 * VỎ OPENAI QUA CỔNG (16/11/2026): trả một đối tượng cùng bề mặt SDK OpenAI để mọi chỗ gọi `getOpenAI().chat.completions.create(...)` cũ
 * đi qua cổng AI chung mà không sửa từng tệp. Chat thường (chữ / JSON / đọc ảnh) → cổng; response_format json_object → dặn JSON + bóc khối JSON;
 * json_schema → schema của cổng; tools / tool_choice / role tool → chế độ công cụ; images.generate → sinh ảnh; embeddings.create → nhúng (16/11/2026). stream: chưa có → `goc`.
 */
export function voOpenAI(goc, viec = 'openai') {
  const create = async (p, opt) => {
    if (p.stream) {
      if (!goc) throw new Error('cổng AI chưa hỗ trợ luồng, và không có khách SDK dự phòng');
      return goc.chat.completions.create(p, opt);
    }
    const chu = (c) => (typeof c === 'string' ? c : (c || []).map((x) => x?.text ?? '').join('\n'));
    const sys = p.messages.filter((m) => m.role === 'system' || m.role === 'developer').map((m) => chu(m.content)).join('\n\n');
    // hội thoại khuôn OpenAI → khuôn Anthropic: assistant.tool_calls → khối tool_use, role tool → khối tool_result (gộp vào lượt user kế)
    const tin = [];
    for (const m of p.messages.filter((x) => x.role !== 'system' && x.role !== 'developer')) {
      if (m.role === 'tool') { const kq = { type: 'tool_result', tool_use_id: m.tool_call_id, content: chu(m.content) }; const t = tin.at(-1);
        if (t?.role === 'user' && Array.isArray(t.content) && t.content.every((b) => b.type === 'tool_result')) t.content.push(kq); else tin.push({ role: 'user', content: [kq] }); continue; }
      const khoi = typeof m.content === 'string' ? (m.content ? [{ type: 'text', text: m.content }] : []) : (m.content || []).map(khoiCong);
      if (m.role === 'assistant') { for (const t of m.tool_calls || []) { let input = {}; try { input = JSON.parse(t.function?.arguments || '{}'); } catch { /* hỏng → rỗng */ } khoi.push({ type: 'tool_use', id: t.id, name: t.function?.name, input }); }
        tin.push({ role: 'assistant', content: khoi }); }
      else tin.push({ role: 'user', content: typeof m.content === 'string' ? m.content : khoi });
    }
    const congCu = p.tools?.length ? { tools: p.tools.filter((t) => t?.function?.name).map((t) => ({ name: t.function.name, description: t.function.description || '', input_schema: t.function.parameters || { type: 'object', properties: {} } })),
      ...(p.tool_choice === 'required' ? { tool_choice: { type: 'any' } } : p.tool_choice?.function?.name ? { tool_choice: { type: 'tool', name: p.tool_choice.function.name } } : p.tool_choice === 'auto' ? { tool_choice: { type: 'auto' } } : {}) } : null;
    const fmt = p.response_format, schema = fmt?.type === 'json_schema' ? fmt.json_schema?.schema : undefined;
    const system = `${sys}${fmt?.type === 'json_object' ? '\n\nReply ONLY with one JSON object, no other text.' : ''}`.trim();
    const r = await goiAi({ viec, model: dongCua(p.model), max_tokens: p.max_tokens || p.max_completion_tokens || 2000, ...(system ? { system } : {}), messages: tin, ...(schema && !congCu ? { schema } : {}), ...(congCu ?? {}) });
    if (congCu) {   // kết quả khuôn Anthropic {content, stop_reason} → choice khuôn OpenAI có tool_calls
      const khoi = r.kq?.content || [], text = khoi.filter((b) => b.type === 'text').map((b) => b.text).join(''), tcs = khoi.filter((b) => b.type === 'tool_use')
        .map((b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      return { id: 'cong-ai', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: r.model,
        choices: [{ index: 0, finish_reason: tcs.length ? 'tool_calls' : r.kq?.stop_reason === 'max_tokens' ? 'length' : 'stop', message: { role: 'assistant', content: text || null, refusal: null, ...(tcs.length ? { tool_calls: tcs } : {}) } }],
        usage: { prompt_tokens: r.vao, completion_tokens: r.ra, total_tokens: r.vao + r.ra, cost_usd: r.chi_usd } };
    }
    const content = typeof r.kq === 'string' ? (fmt ? layJson(r.kq) : r.kq) : JSON.stringify(r.kq);
    return { id: 'cong-ai', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: r.model,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content, refusal: null } }],
      usage: { prompt_tokens: r.vao, completion_tokens: r.ra, total_tokens: r.vao + r.ra, cost_usd: r.chi_usd } };
  };
  // ẢNH + NHÚNG qua cổng (16/11/2026): images.generate → loai 'anh' (b64_json), embeddings.create → loai 'nhung' (véc-tơ 512 chiều đã chuẩn hoá)
  const TL = { '1024x1024': '1:1', '1024x1536': '2:3', '1536x1024': '3:2', '1024x1792': '9:16', '1792x1024': '16:9', auto: '1:1' };
  const images = { generate: async (p) => { const r = await sinhAnhAi({ viec, prompt: p.prompt, ti_le: TL[p.size] || '1:1' });
    return { created: Math.floor(Date.now() / 1000), data: [{ b64_json: r.anh_b64 }], model: r.model, usage: { cost_usd: r.chi_usd } }; } };
  const embeddings = { create: async (p) => { const chu = Array.isArray(p.input) ? p.input : [p.input]; const r = await nhungAi({ viec, chu });
    return { object: 'list', model: r.model, data: r.vec.map((embedding, index) => ({ object: 'embedding', index, embedding })), usage: { prompt_tokens: 0, total_tokens: 0 } }; } };
  return { chat: { completions: { create } }, images, embeddings };
}

/** Sinh MỘT ảnh qua cổng (chuỗi ckey Nano Banana → ShopAIKey). tham_chieu = URL công khai. → { anh_b64, mime, model, chi_usd } */
export async function sinhAnhAi({ viec, prompt, ti_le = '1:1', tham_chieu = [], ma }) {
  const r = await goiCong({ viec, loai: 'anh', prompt, ti_le, tham_chieu, ma }, 6 * 60e3);
  if (!r.anh_b64) throw new Error('cổng AI: không có ảnh');
  return r;
}
/** Một câu thoại (≤ 1.000 ký tự) → mp3 qua cổng (ckey ElevenLabs → fal → ElevenLabs chính hãng). giong = tên (Brian, Charlotte…) hoặc mã 20 ký tự. */
export async function giongAi({ viec, chu, giong, engine, language, ma }) { return goiCong({ viec, loai: 'giong', chu, giong, engine, language, ma }, 6 * 60e3); }
/** Gửi một việc video (khung đầu = URL công khai) → { cong, model, task_id, tao_luc, chi_usd }; hỏi lại bằng docVideoAi. */
export async function guiVideoAi(o) { return goiCong({ loai: 'video_gui', ...o }, 3 * 60e3); }
/** Hỏi trạng thái việc video → { done, ok?, uri?, can_khoa?, loi? } (can_khoa: link Veo — tải qua taiVideoAi) */
export async function docVideoAi({ viec, cong, task_id, tao_luc }) { return goiCong({ viec, loai: 'video_doc', cong, task_id, tao_luc }, 90e3); }
export async function taiVideoAi({ viec, uri }) { return goiCong({ viec, loai: 'video_tai', uri }, 6 * 60e3); }
/** Nhúng chữ qua cổng → { vec: số[][] (512 chiều, đã chuẩn hoá), chieu, model } */
export async function nhungAi({ viec, chu, ma }) { return goiCong({ viec, loai: 'nhung', chu, ma }, 3 * 60e3); }
async function goiCong(than, hanMs) {
  const khoa = congKhoa(); if (!khoa) throw new Error('thiếu CONG_AI_KEY (box3: /root/.secrets/spy.env · máy khác: ~/.secrets/cong-ai.env)');
  const r = await fetch(congUrl(), { method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json' }, body: JSON.stringify(than), signal: AbortSignal.timeout(hanMs) });
  const j = await r.json().catch(() => ({ loi: `cổng AI trả HTTP ${r.status} không phải JSON` }));
  if (!r.ok || j.loi) throw new Error(`cổng AI: ${j.loi || `HTTP ${r.status}`}`);
  return j;
}
