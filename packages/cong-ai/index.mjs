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
 * json_schema → schema của cổng. Lượt có tools / stream, images, embeddings: cổng CHƯA có → đi `goc` (khách SDK cũ) — thêm vào cổng thì gỡ nhánh này.
 */
export function voOpenAI(goc, viec = 'openai') {
  const create = async (p, opt) => {
    if (p.tools?.length || p.stream) {
      if (!goc) throw new Error('cổng AI chưa hỗ trợ công cụ / luồng, và không có khách SDK dự phòng');
      return goc.chat.completions.create(p, opt);
    }
    const chu = (c) => (typeof c === 'string' ? c : (c || []).map((x) => x?.text ?? '').join('\n'));
    const sys = p.messages.filter((m) => m.role === 'system' || m.role === 'developer').map((m) => chu(m.content)).join('\n\n');
    const tin = p.messages.filter((m) => m.role !== 'system' && m.role !== 'developer')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: typeof m.content === 'string' ? m.content : (m.content || []).map(khoiCong) }));
    const fmt = p.response_format, schema = fmt?.type === 'json_schema' ? fmt.json_schema?.schema : undefined;
    const system = `${sys}${fmt?.type === 'json_object' ? '\n\nReply ONLY with one JSON object, no other text.' : ''}`.trim();
    const r = await goiAi({ viec, model: dongCua(p.model), max_tokens: p.max_tokens || p.max_completion_tokens || 2000, ...(system ? { system } : {}), messages: tin, ...(schema ? { schema } : {}) });
    const content = typeof r.kq === 'string' ? (fmt ? layJson(r.kq) : r.kq) : JSON.stringify(r.kq);
    return { id: 'cong-ai', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: r.model,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content, refusal: null } }],
      usage: { prompt_tokens: r.vao, completion_tokens: r.ra, total_tokens: r.vao + r.ra, cost_usd: r.chi_usd } };
  };
  return { chat: { completions: { create } }, images: goc?.images, embeddings: goc?.embeddings };
}
