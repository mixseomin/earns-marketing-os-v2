#!/usr/bin/env node
// Proxy đa mô hình của công ty (bước 1 sổ C06) — MỘT cửa cho mọi nhân sự gọi mô hình, theo dạng Anthropic Messages API:
//   POST /v1/messages  { model: "<nhà>:<tên>", system, messages, max_tokens, tools? }   header x-cty-staff: <id nhân sự>
//   nhà "anthropic" (và nhà khác nói giọng Anthropic: deepseek, glm…) → chuyển thẳng; nhà "openai" → dịch sang chat completions
//   và dịch ngược (mượn toOpenAI/toAnthropic của bagidea-office, bỏ phần Gemini/stream).
// Ba việc proxy làm thêm, đúng ba thứ không repo mẫu nào có:
//   1. TRẦN CHI: trước mỗi lượt đọc chi tháng này của nhân sự (ai_usage.feature = 'cty:<id>') và của cả công ty; vượt
//      tran_usd_thang trong SOUL.md hoặc tran_tong_usd_thang trong cong-ty/cau-hinh.md → 429, không gọi. Mô hình chưa có
//      giá trong gia-model.json → 400 (fail-closed: không đếm được tiền thì không cho chạy).
//   2. GHI SỔ: mỗi lượt một dòng ai_usage (feature 'cty:<id>', model, token) — cùng bảng MOS2 đang dùng, An đọc được ngay.
//   3. CACHE theo hash: CTY_CACHE=1 → cùng body → trả bản đã lưu (~/.cty-cache), chạy lại kịch bản $0.
// Khoá thật chỉ nằm ở đây (env OPENAI_API_KEY / ANTHROPIC_API_KEY / <NHÀ>_API_KEY); nhân sự không bao giờ thấy khoá.
// Chạy bằng unit deploy/mos2-cty-proxy.service. `node worker/proxy.mjs --tu-kiem` = tự kiểm với upstream giả.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { giaCua, tienUsd, tienGoi } from './gia.mjs';
import crypto from 'node:crypto';
import { parseFm } from '../scripts/fm.mjs';
import { ghiLog } from './log.mjs';

const DIR = path.join(GOC, 'worker');   // xem worker/goc.mjs
const CONG_TY = path.join(DIR, '..', 'cong-ty');
const CACHE_DIR = path.join(os.homedir(), '.cty-cache');

// MỘT CỔNG AI (anh 16/11/2026: "Spy đang có chuỗi fallback hoàn chỉnh, hãy sử dụng nó làm chuẩn để có 1 nguồn dùng API duy nhất cho mọi model"):
// proxy KHÔNG còn gọi nhà cung cấp, không giữ khoá nhà cung cấp, không tự chọn người bán ckey — mọi lượt đi cổng chung spy POST /api/ai (chuỗi goi() của spy:
// donk → ckey sống → fal, bo_chinh_hang). Proxy giữ ba việc riêng: trần chi, sổ ai_usage, cache. Trước 16/11 tệp này tự giữ người bán ckey + đường về nhà gốc.
// NHA = tên nhà được phép trong tên model "<nhà>:<tên>" (kiểm đầu vào); tenCong đổi về tên mô hình theo bảng spy.
export const NHA = { anthropic: {}, deepseek: {}, openai: {}, openrouter: {}, fal: {}, ckey: {} };
const CONG_URL = () => process.env.CONG_AI_URL || 'http://127.0.0.1:3850/api/ai';
const congKhoa = () => process.env.CONG_AI_KEY || (() => { try { return fs.readFileSync('/root/.secrets/spy.env', 'utf8').match(/^CONG_AI_KEY=(.*)$/m)?.[1]?.replace(/["']/g, '').trim() || null; } catch { return null; } })();
export function tenCong(model) {
  const [nha, ...r] = model.includes(':') ? model.split(':') : ['anthropic', model], ten = r.join(':') || nha;
  if (nha === 'anthropic') return /opus/i.test(ten) ? 'fal:anthropic/claude-opus-5.5' : /sonnet/i.test(ten) ? 'fal:anthropic/claude-sonnet-5.5' : 'claude-haiku-5-5';
  if (nha === 'fal' || nha === 'ckey') return `${nha}:${ten}`;
  return `fal:${nha === 'openrouter' ? ten : `${nha}/${ten}`}`;   // openai / deepseek … → tên OpenRouter qua fal
}

// ---------- dịch Anthropic → OpenAI (text, ảnh base64, tool_use/tool_result) ----------
const sysText = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n') : '');
export function toOpenAI(a, model) {
  const msgs = []; const sys = sysText(a.system);
  for (const m of a.messages || []) {
    if (typeof m.content === 'string') { msgs.push({ role: m.role, content: m.content }); continue; }
    const parts = [], toolCalls = [], toolResults = [];
    for (const b of m.content || []) {
      if (b.type === 'text') parts.push({ type: 'text', text: b.text || '' });
      else if (b.type === 'image' && b.source) { const s = b.source; const url = s.type === 'base64' ? `data:${s.media_type};base64,${s.data}` : s.url; if (url) parts.push({ type: 'image_url', image_url: { url } }); }
      else if (b.type === 'tool_use') toolCalls.push({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } });
      else if (b.type === 'tool_result') { let c = b.content; if (Array.isArray(c)) c = c.map((x) => (x && x.type === 'text' ? x.text : JSON.stringify(x))).join('\n'); else if (typeof c !== 'string') c = JSON.stringify(c ?? ''); toolResults.push({ role: 'tool', tool_call_id: b.tool_use_id, content: c || '' }); }
    }
    if (m.role === 'user') {
      for (const tr of toolResults) msgs.push(tr);
      if (parts.length) msgs.push({ role: 'user', content: parts.every((p) => p.type === 'text') ? parts.map((p) => p.text).join('\n') : parts });
    } else {
      const am = { role: 'assistant', content: parts.filter((p) => p.type === 'text').map((p) => p.text).join('') };
      if (toolCalls.length) am.tool_calls = toolCalls;
      msgs.push(am);
    }
  }
  if (sys) msgs.unshift({ role: 'system', content: sys });
  const out = { model, messages: msgs };
  if (a.max_tokens) out.max_tokens = a.max_tokens;
  if (a.temperature != null) out.temperature = a.temperature;
  if (a.reasoning) out.reasoning = a.reasoning;   // OpenRouter/fal: {effort:'none'} tắt suy luận ngầm (mặc định nó ăn hết max_tokens → trả rỗng)
  if (Array.isArray(a.tools) && a.tools.length) {
    out.tools = a.tools.filter((t) => t && t.name && t.input_schema).map((t) => ({ type: 'function', function: { name: t.name, description: t.description || '', parameters: t.input_schema } }));
    const tc = a.tool_choice;
    if (tc?.type === 'auto') out.tool_choice = 'auto'; else if (tc?.type === 'any') out.tool_choice = 'required'; else if (tc?.type === 'tool' && tc.name) out.tool_choice = { type: 'function', function: { name: tc.name } };
  }
  return out;
}
const STOP = { stop: 'end_turn', length: 'max_tokens', tool_calls: 'tool_use' };
export function toAnthropic(o, model) {
  const choice = (o.choices || [])[0] || {}; const msg = choice.message || {}; const content = [];
  if (typeof msg.content === 'string' && msg.content.trim()) content.push({ type: 'text', text: msg.content });
  for (const tc of msg.tool_calls || []) { let input = {}; try { input = JSON.parse(tc.function?.arguments || '{}'); } catch {} content.push({ type: 'tool_use', id: tc.id, name: tc.function?.name, input }); }
  return { id: o.id || 'msg_proxy', type: 'message', role: 'assistant', model, content, stop_reason: STOP[choice.finish_reason] || 'end_turn', stop_sequence: null,
    usage: { input_tokens: o.usage?.prompt_tokens || 0, output_tokens: o.usage?.completion_tokens || 0, ...(o.usage?.cost != null ? { cost_usd: o.usage.cost } : {}), ...(o.usage?.completion_tokens_details?.reasoning_tokens ? { reasoning_tokens: o.usage.completion_tokens_details.reasoning_tokens } : {}) } };   // nhà báo tiền thật (fal/OpenRouter) thì giữ
}

// ---------- trần chi ----------
export { giaCua, tienUsd } from './gia.mjs';   // giá: một nguồn (worker/gia.mjs)
export function tranCua(staff) {
  const f = path.join(CONG_TY, 'nhan-su', staff, 'SOUL.md');
  if (!fs.existsSync(f)) return null;
  const fm = parseFm(fs.readFileSync(f, 'utf8')).fm;
  return { nguoi: Number(fm.tran_usd_thang || 0), heartbeat: String(fm.heartbeat ?? 'off') };
}
export function tranTong() {
  const f = path.join(CONG_TY, 'cau-hinh.md');
  return fs.existsSync(f) ? Number(parseFm(fs.readFileSync(f, 'utf8')).fm.tran_tong_usd_thang || 0) : 0;
}

/** Nhãn sổ chi: 'cty:<người>' hoặc 'cty:<người>@<phòng>' (header x-cty-phong — tiền tính theo phòng người đó đang làm cho, anh 13/10/2026).
 *  Trần chi vẫn tính trên MỌI phòng của người đó. */
export const nhanChi = (staff, phong) => `cty:${staff}${phong && /^[a-z0-9-]+$/.test(phong) ? `@${phong}` : ''}`;
// Sổ chi: Postgres (bảng ai_usage của MOS2) — hoặc bộ nhớ khi tự kiểm (CTY_DB=mem).
function soChi() {
  if (process.env.CTY_DB === 'mem') {
    const rows = [];
    return {
      async chiThang(staff) { return rows.filter((r) => !staff || r.feature === `cty:${staff}` || r.feature.startsWith(`cty:${staff}@`)).reduce((s, r) => s + (tienUsd(r.model, r) ?? 0), 0); },
      async ghi(staff, model, u, phong) { rows.push({ feature: nhanChi(staff, phong), model, ...u }); },
    };
  }
  let sqlP;
  const sql = async () => (sqlP ??= import('postgres').then((m) => m.default(process.env.DATABASE_URL, { max: 2, prepare: false })));
  return {
    async chiThang(staff) {
      const q = await sql();
      const rows = await q`SELECT model, prompt_tokens, completion_tokens FROM ai_usage WHERE feature LIKE 'cty:%' ${staff ? q`AND (feature = ${'cty:' + staff} OR feature LIKE ${'cty:' + staff + '@%'})` : q``} AND created_at >= date_trunc('month', now())`;
      return rows.reduce((s, r) => s + (tienUsd(r.model, { input_tokens: r.prompt_tokens, output_tokens: r.completion_tokens }) ?? 0), 0);
    },
    async ghi(staff, model, u, phong) {
      const q = await sql();
      await q`INSERT INTO ai_usage (feature, model, prompt_tokens, completion_tokens) VALUES (${nhanChi(staff, phong)}, ${model}, ${u.input_tokens || 0}, ${u.output_tokens || 0})`;
    },
  };
}

// ---------- xử lý một lượt ----------
export async function xuLy(body, staff, so, fetchFn = fetch, phong = null) {
  const model = String(body.model || '');
  const [nha] = model.includes(':') ? model.split(':') : ['anthropic'];
  if (!NHA[nha]) return [400, { error: `nhà "${nha}" chưa khai trong NHA` }];
  if (!staff) return [400, { error: 'thiếu header x-cty-staff' }];
  const tran = tranCua(staff); if (!tran) return [403, { error: `nhân sự "${staff}" không có hồ sơ` }];
  if (!giaCua(model)) return [400, { error: `mô hình "${model}" chưa có giá trong gia-model.json — không đếm được tiền thì không chạy` }];
  const [chiNguoi, chiTong] = await Promise.all([so.chiThang(staff), so.chiThang(null)]);
  if (tran.nguoi > 0 && chiNguoi >= tran.nguoi) return [429, { error: `${staff} đã chi $${chiNguoi.toFixed(2)} / trần $${tran.nguoi} tháng này — báo An` }];
  const tong = tranTong(); if (tong > 0 && chiTong >= tong) return [429, { error: `cả công ty đã chi $${chiTong.toFixed(2)} / trần tổng $${tong} — báo Giám đốc` }];

  const { thang: _thang, ...goc } = body;   // thang (bộ đo model do-model.mjs) bỏ 16/11/2026: tuyến do cổng AI chung chọn, proxy không đi thẳng nhà nào
  const clean = { ...goc, stream: false };
  const hash = crypto.createHash('sha256').update(JSON.stringify(clean)).digest('hex');
  const cacheF = path.join(CACHE_DIR, `${hash}.json`);
  if (process.env.CTY_CACHE === '1' && fs.existsSync(cacheF)) return [200, { ...JSON.parse(fs.readFileSync(cacheF, 'utf8')), _cache: true }];

  const luu = (d) => { if (process.env.CTY_CACHE === '1') { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(cacheF, JSON.stringify(d)); } return [200, d]; };

  const khoa = congKhoa(); if (!khoa) return [500, { error: 'thiếu CONG_AI_KEY (/root/.secrets/spy.env) — proxy chỉ gọi mô hình qua cổng AI chung' }];
  const r = await fetchFn(CONG_URL(), { method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15 * 60e3),
    body: JSON.stringify({ viec: `cty-${staff}`.slice(0, 60), ma: phong || null, model: tenCong(model), max_tokens: clean.max_tokens || 1000, system: sysText(clean.system) || undefined,
      messages: clean.messages, bo_chinh_hang: true }) });
  const j = await r.json().catch(() => ({ loi: `cổng AI trả HTTP ${r.status} không phải JSON` }));
  if (!r.ok || j.loi) return [502, { error: `cổng AI: ${j.loi || `HTTP ${r.status}`}` }];
  const data = { id: 'cong-ai', type: 'message', role: 'assistant', model, tuyen: j.model, content: [{ type: 'text', text: typeof j.kq === 'string' ? j.kq : JSON.stringify(j.kq) }],
    stop_reason: 'end_turn', usage: { input_tokens: j.vao || 0, output_tokens: j.ra || 0, cost_usd: j.chi_usd ?? null, vnd: j.chi_usd != null ? Math.round(j.chi_usd * 26000 * 100) / 100 : null } };
  await so.ghi(staff, model, data.usage, phong);
  return luu(data);
}

export function server(port, so = soChi()) {
  return http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/messages') { res.writeHead(404); return res.end(); }
    let raw = ''; for await (const c of req) raw += c;
    let body; try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end('{"error":"json"}'); }
    const t0 = Date.now();
    const [code, data] = await xuLy(body, req.headers['x-cty-staff'], so, fetch, req.headers['x-cty-phong'] || null).catch((e) => [502, { error: String(e.message || e) }]);
    ghiLog({ luot: req.headers['x-cty-luot'] || null, loai: code === 200 ? 'goi' : 'loi', tu: req.headers['x-cty-staff'] || null,
      chi_tiet: { model: body.model, http: code, ms: Date.now() - t0, usage: data.usage || null, usd: tienGoi(String(body.model), data.usage), cache: !!data._cache, loi: data.error || null, he_thong_ky_tu: String(body.system || '').length, tin_nhan: (body.messages || []).length } });
    res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data));
  }).listen(port, '127.0.0.1');
}

// ---------- tự kiểm: CỔNG AI giả, sổ chi bộ nhớ ----------
if (process.argv.includes('--tu-kiem')) {
  process.env.CTY_DB = 'mem'; process.env.CTY_CACHE = '0'; process.env.CONG_AI_KEY = 'kc';
  const assert = (c, m) => { if (!c) { console.error('✗ proxy:', m); process.exit(1); } };
  let auth = '', hong = false; const nhan = [];
  const fake = http.createServer(async (req, res) => { auth = req.headers.authorization; let raw = ''; for await (const c of req) raw += c; const b = JSON.parse(raw); nhan.push(b);
    if (hong) { res.writeHead(400); return res.end(JSON.stringify({ loi: 'mọi tuyến hỏng — thử' })); }
    res.end(JSON.stringify({ kq: 'chào Lan', model: 'ckey:x/claude-haiku-5-5', vao: 1_000_000, ra: 0, chi_usd: 0.001 })); }).listen(0, '127.0.0.1');
  await new Promise((r) => fake.once('listening', r));
  process.env.CONG_AI_URL = `http://127.0.0.1:${fake.address().port}/api/ai`;
  const so = soChi();
  const req = { model: 'openai:gpt-4o-mini', system: 'bạn là Lan', messages: [{ role: 'user', content: 'xin chào' }], max_tokens: 50 };
  let [c, d] = await xuLy(req, 'lan', so); let b = nhan.at(-1);
  assert(c === 200 && d.content[0].text === 'chào Lan' && d.usage.input_tokens === 1_000_000 && d.tuyen === 'ckey:x/claude-haiku-5-5' && d.model === req.model, `ca 1 gọi qua cổng + trả khuôn Anthropic: ${c} ${JSON.stringify(d).slice(0, 120)}`);
  assert(auth === 'Bearer kc' && b.viec === 'cty-lan' && b.model === 'fal:openai/gpt-4o-mini' && b.system === 'bạn là Lan' && b.messages[0].content === 'xin chào' && b.bo_chinh_hang === true, `ca 2 thân gửi cổng đúng (khoá, viec, tên model, system, không chính hãng): ${JSON.stringify(b).slice(0, 160)}`);
  [c, d] = await xuLy({ ...req, model: 'openai:gpt-9-chua-co-gia' }, 'lan', so); assert(c === 400, 'ca 3 mô hình chưa có giá → 400');
  [c, d] = await xuLy(req, 'khong-co', so); assert(c === 403, 'ca 4 nhân sự không hồ sơ → 403');
  [c, d] = await xuLy({ ...req, model: 'nhala:x' }, 'lan', so); assert(c === 400, 'ca 5 nhà lạ → 400');
  assert(tenCong('anthropic:claude-sonnet-5-5') === 'fal:anthropic/claude-sonnet-5.5' && tenCong('claude-haiku-4-5') === 'claude-haiku-5-5' && tenCong('fal:google/gemini-3.8-flash') === 'fal:google/gemini-3.8-flash'
    && tenCong('ckey:a/b') === 'ckey:a/b' && tenCong('openrouter:x/y') === 'fal:x/y', 'ca 6 đổi tên model về bảng spy');
  const n0 = nhan.length; [c, d] = await xuLy({ ...req, thang: true }, 'lan', so); assert(c === 200 && nhan.length === n0 + 1 && !('thang' in nhan.at(-1)), 'ca 7 cờ thang không gửi ra ngoài');
  hong = true; [c, d] = await xuLy(req, 'lan', so); assert(c === 502 && /cổng AI: mọi tuyến hỏng/.test(d.error), `ca 8 cổng hỏng → 502 kèm lý do (${c} ${d.error})`); hong = false;
  assert(nhanChi('lan', 'sach') === 'cty:lan@sach' && nhanChi('lan', null) === 'cty:lan' && nhanChi('lan', 'x;drop') === 'cty:lan', 'ca 9 nhãn sổ chi theo phòng (phòng lạ → bỏ)');
  for (let i = 0; i < 300; i++) await so.ghi('lan', 'openai:gpt-4o-mini', { input_tokens: 1_000_000, output_tokens: 0 }, i % 2 ? 'sach' : null);   // trần cộng MỌI phòng
  [c, d] = await xuLy(req, 'lan', so); assert(c === 429 && /trần/.test(d.error), `ca 10 vượt trần người → 429 (${c})`);
  delete process.env.CONG_AI_KEY; const k0 = process.env.CONG_AI_KEY; [c, d] = await xuLy(req, 'ha', so); assert(k0 !== undefined || c === 500 || c === 200, 'ca 11 thiếu khoá cổng → 500 (máy có spy.env thì dùng khoá đó)');
  fake.close(); console.log('✓ proxy: 11 ca đạt (qua cổng AI chung · thân gửi đúng · giá fail-closed · hồ sơ · nhà lạ · đổi tên model · không gửi cờ thang · cổng hỏng 502 · nhãn phòng · trần người · thiếu khoá)'); process.exit(0);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1])) && !process.argv.includes('--tu-kiem')) {
  const port = Number(process.env.PORT || 3862);
  server(port); console.log(`cty proxy :${port} — nhân sự gọi POST /v1/messages với x-cty-staff`);
}
