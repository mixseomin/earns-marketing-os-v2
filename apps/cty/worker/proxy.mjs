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
// CHƯA CÓ UNIT SYSTEMD — đợt tham quan không chạy. `node worker/proxy.mjs --tu-kiem` = 4 ca tự kiểm với upstream giả.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { giaCua, tienUsd } from './gia.mjs';
import crypto from 'node:crypto';
import { parseFm } from '../scripts/fm.mjs';
import { ghiLog } from './log.mjs';

const DIR = path.join(GOC, 'worker');   // xem worker/goc.mjs
const CONG_TY = path.join(DIR, '..', 'cong-ty');
const CACHE_DIR = path.join(os.homedir(), '.cty-cache');

// Nhà cung cấp: dạng API + địa chỉ + tên biến khoá. Nhà mới = thêm một dòng (bagidea providers.js có danh sách dài hơn).
export const NHA = {
  anthropic: { dang: 'anthropic', url: 'https://api.anthropic.com/v1/messages', key: 'ANTHROPIC_API_KEY' },
  deepseek: { dang: 'anthropic', url: 'https://api.deepseek.com/anthropic/v1/messages', key: 'DEEPSEEK_API_KEY' },
  openai: { dang: 'openai', url: 'https://api.openai.com/v1/chat/completions', key: 'OPENAI_API_KEY' },
  openrouter: { dang: 'openai', url: 'https://openrouter.ai/api/v1/chat/completions', key: 'OPENROUTER_API_KEY' },
};

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
    usage: { input_tokens: o.usage?.prompt_tokens || 0, output_tokens: o.usage?.completion_tokens || 0 } };
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

// Sổ chi: Postgres (bảng ai_usage của MOS2) — hoặc bộ nhớ khi tự kiểm (CTY_DB=mem).
function soChi() {
  if (process.env.CTY_DB === 'mem') {
    const rows = [];
    return {
      async chiThang(staff) { return rows.filter((r) => !staff || r.feature === `cty:${staff}`).reduce((s, r) => s + (tienUsd(r.model, r) ?? 0), 0); },
      async ghi(staff, model, u) { rows.push({ feature: `cty:${staff}`, model, ...u }); },
    };
  }
  let sqlP;
  const sql = async () => (sqlP ??= import('postgres').then((m) => m.default(process.env.DATABASE_URL, { max: 2, prepare: false })));
  return {
    async chiThang(staff) {
      const q = await sql();
      const rows = await q`SELECT model, prompt_tokens, completion_tokens FROM ai_usage WHERE feature LIKE 'cty:%' ${staff ? q`AND feature = ${'cty:' + staff}` : q``} AND created_at >= date_trunc('month', now())`;
      return rows.reduce((s, r) => s + (tienUsd(r.model, { input_tokens: r.prompt_tokens, output_tokens: r.completion_tokens }) ?? 0), 0);
    },
    async ghi(staff, model, u) {
      const q = await sql();
      await q`INSERT INTO ai_usage (feature, model, prompt_tokens, completion_tokens) VALUES (${'cty:' + staff}, ${model}, ${u.input_tokens || 0}, ${u.output_tokens || 0})`;
    },
  };
}

// ---------- xử lý một lượt ----------
export async function xuLy(body, staff, so, fetchFn = fetch) {
  const model = String(body.model || '');
  const [nha] = model.includes(':') ? model.split(':') : ['anthropic'];
  const cfg = NHA[nha]; if (!cfg) return [400, { error: `nhà "${nha}" chưa khai trong NHA` }];
  if (!staff) return [400, { error: 'thiếu header x-cty-staff' }];
  const tran = tranCua(staff); if (!tran) return [403, { error: `nhân sự "${staff}" không có hồ sơ` }];
  if (!giaCua(model)) return [400, { error: `mô hình "${model}" chưa có giá trong gia-model.json — không đếm được tiền thì không chạy` }];
  const [chiNguoi, chiTong] = await Promise.all([so.chiThang(staff), so.chiThang(null)]);
  if (tran.nguoi > 0 && chiNguoi >= tran.nguoi) return [429, { error: `${staff} đã chi $${chiNguoi.toFixed(2)} / trần $${tran.nguoi} tháng này — báo An` }];
  const tong = tranTong(); if (tong > 0 && chiTong >= tong) return [429, { error: `cả công ty đã chi $${chiTong.toFixed(2)} / trần tổng $${tong} — báo Giám đốc` }];

  const clean = { ...body, stream: false };
  const hash = crypto.createHash('sha256').update(JSON.stringify(clean)).digest('hex');
  const cacheF = path.join(CACHE_DIR, `${hash}.json`);
  if (process.env.CTY_CACHE === '1' && fs.existsSync(cacheF)) return [200, { ...JSON.parse(fs.readFileSync(cacheF, 'utf8')), _cache: true }];

  const key = process.env[cfg.key]; if (!key) return [500, { error: `thiếu ${cfg.key} trong env của proxy` }];
  const url = process.env[`CTY_UPSTREAM_${nha.toUpperCase()}`] || cfg.url;   // tự kiểm trỏ upstream giả
  const ten = model.split(':').pop();
  let res, data;
  if (cfg.dang === 'openai') {
    res = await fetchFn(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(toOpenAI(clean, ten)) });
    const o = await res.json(); if (!res.ok) return [res.status, o];
    data = toAnthropic(o, model);
  } else {
    res = await fetchFn(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ ...clean, model: ten }) });
    data = await res.json(); if (!res.ok) return [res.status, data];
    data.model = model;
  }
  await so.ghi(staff, model, data.usage || {});
  if (process.env.CTY_CACHE === '1') { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(cacheF, JSON.stringify(data)); }
  return [200, data];
}

export function server(port, so = soChi()) {
  return http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/messages') { res.writeHead(404); return res.end(); }
    let raw = ''; for await (const c of req) raw += c;
    let body; try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end('{"error":"json"}'); }
    const t0 = Date.now();
    const [code, data] = await xuLy(body, req.headers['x-cty-staff'], so).catch((e) => [502, { error: String(e.message || e) }]);
    ghiLog({ luot: req.headers['x-cty-luot'] || null, loai: code === 200 ? 'goi' : 'loi', tu: req.headers['x-cty-staff'] || null,
      chi_tiet: { model: body.model, http: code, ms: Date.now() - t0, usage: data.usage || null, usd: data.usage ? tienUsd(String(body.model), data.usage) : null, cache: !!data._cache, loi: data.error || null, he_thong_ky_tu: String(body.system || '').length, tin_nhan: (body.messages || []).length } });
    res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data));
  }).listen(port, '127.0.0.1');
}

// ---------- tự kiểm: upstream giả OpenAI, sổ chi bộ nhớ ----------
if (process.argv.includes('--tu-kiem')) {
  process.env.CTY_DB = 'mem'; process.env.OPENAI_API_KEY = 'test'; process.env.CTY_CACHE = '0';
  const assert = (c, m) => { if (!c) { console.error('✗ proxy:', m); process.exit(1); } };
  const fake = http.createServer(async (req, res) => { let raw = ''; for await (const c of req) raw += c; const b = JSON.parse(raw);
    assert(b.messages[0].role === 'system' && b.messages[1].content === 'xin chào', 'dịch Anthropic→OpenAI (system + user)');
    res.end(JSON.stringify({ id: 'x', choices: [{ message: { content: 'chào Lan' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1_000_000, completion_tokens: 0 } })); }).listen(0, '127.0.0.1');
  await new Promise((r) => fake.once('listening', r));
  process.env.CTY_UPSTREAM_OPENAI = `http://127.0.0.1:${fake.address().port}`;
  const so = soChi();
  const req = { model: 'openai:gpt-4o-mini', system: 'bạn là Lan', messages: [{ role: 'user', content: 'xin chào' }], max_tokens: 50 };
  let [c, d] = await xuLy(req, 'lan', so); assert(c === 200 && d.content[0].text === 'chào Lan' && d.usage.input_tokens === 1_000_000, `ca 1 gọi + dịch ngược: ${c} ${JSON.stringify(d).slice(0, 120)}`);
  [c, d] = await xuLy({ ...req, model: 'openai:gpt-9-chua-co-gia' }, 'lan', so); assert(c === 400, 'ca 2 mô hình chưa có giá → 400');
  [c, d] = await xuLy(req, 'khong-co', so); assert(c === 403, 'ca 3 nhân sự không hồ sơ → 403');
  // ca 4: Lan trần $40; mỗi lượt giả 1M token vào gpt-4o-mini = $0.15 → cần 267 lượt; gọi thẳng so.ghi để vượt trần rồi kiểm 429
  for (let i = 0; i < 300; i++) await so.ghi('lan', 'openai:gpt-4o-mini', { input_tokens: 1_000_000, output_tokens: 0 });
  [c, d] = await xuLy(req, 'lan', so); assert(c === 429 && /trần/.test(d.error), `ca 4 vượt trần người → 429 (${c})`);
  fake.close(); console.log('✓ proxy: 4 ca đạt (dịch 2 chiều · giá fail-closed · hồ sơ · trần người)'); process.exit(0);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1])) && !process.argv.includes('--tu-kiem')) {
  const port = Number(process.env.PORT || 3862);
  server(port); console.log(`cty proxy :${port} — nhân sự gọi POST /v1/messages với x-cty-staff`);
}
