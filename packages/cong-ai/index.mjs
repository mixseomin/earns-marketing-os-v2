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
      body: JSON.stringify({ ...o, model: o.model || MO_HINH.haiku, bo_tuyen: bo }), signal: AbortSignal.timeout(hanMs) });
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
