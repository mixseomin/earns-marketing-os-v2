// CỔNG AI CHUNG — studio gọi mô hình chữ / nhìn ảnh QUA MỘT CỔNG của cả hệ (anh 16/11/2026: "hiện đã có cổng chung và duy nhất cho việc gọi API AI").
// Cổng: spy-on-tc/server/cong-ai.mjs — POST /api/ai, khoá Bearer CONG_AI_KEY (/root/.secrets/spy.env). Chuỗi tuyến do CỔNG chọn (donk → ckey danh sách sống →
// fal → chính hãng LUÔN CUỐI) và ghi sổ ai_luot của spy; nơi gọi KHÔNG giữ khoá nhà cung cấp, không tự xếp tuyến. Trước 16/11 studio tự giữ chuỗi
// ckey → ShopAIKey → Google trong soi-bien-dang.ts › goiGeminiJson — ckey hết tiền + khoá ShopAIKey chết là cả studio rơi về Google chính hãng mà không ai biết.
// Trên box3 gọi nội bộ 127.0.0.1:3850 (không qua mạng ngoài); máy khác gọi https://spy.on.tc/api/ai với khoá ở ~/.secrets/cong-ai.env.
import 'server-only';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const TEP_BOX = '/root/.secrets/spy.env';
const docKhoa = (tep: string) => { try { return readFileSync(tep, 'utf8').match(/^CONG_AI_KEY=(.*)$/m)?.[1]?.replace(/["']/g, '').trim() || null; } catch { return null; } };
export const khoaCongAi = (): string | null => process.env.CONG_AI_KEY || docKhoa(TEP_BOX) || docKhoa(`${homedir()}/.secrets/cong-ai.env`);
const urlCongAi = () => process.env.CONG_AI_URL || (existsSync(TEP_BOX) ? 'http://127.0.0.1:3850/api/ai' : 'https://spy.on.tc/api/ai');
/** Tỉ giá cổng trả chi_usd → VNĐ (cùng số với Ethopex ai_chu.py). */
export const VND_MOI_USD_CONG = 26000;

export type KhoiNoiDung = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
export type KqCongAi<T> = { kq: T; model: string; vao: number; ra: number; vnd: number | null };
/** MỘT lượt qua cổng. viec = tên nơi gọi (sổ ai_luot: 'cong:xv-<viec>'). schema = JSON Schema → kq là đối tượng. null = mọi tuyến hỏng / thiếu khoá (có log lý do). */
export async function goiCongAi<T>(o: { viec: string; noiDung: KhoiNoiDung[]; schema?: unknown; model?: string; maxTokens?: number; system?: string }): Promise<KqCongAi<T> | null> {
  const k = khoaCongAi(); if (!k) { console.error('[cổng AI] thiếu CONG_AI_KEY'); return null; }
  try {
    const r = await fetch(urlCongAi(), { method: 'POST', headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' },
      body: JSON.stringify({ viec: `xv-${o.viec}`, model: o.model ?? 'claude-haiku-5-5', noi_dung: o.noiDung, schema: o.schema, max_tokens: o.maxTokens ?? 8000, system: o.system }) });
    const j = await r.json() as { kq?: T; model?: string; vao?: number; ra?: number; chi_usd?: number; loi?: string };
    if (!r.ok || j.loi || j.kq == null) { console.error('[cổng AI]', r.status, j.loi ?? 'không có kq'); return null; }
    return { kq: j.kq, model: j.model ?? 'cong', vao: j.vao ?? 0, ra: j.ra ?? 0, vnd: typeof j.chi_usd === 'number' ? Math.round(j.chi_usd * VND_MOI_USD_CONG * 100) / 100 : null };
  } catch (e) { console.error('[cổng AI]', e instanceof Error ? e.message : e); return null; }
}
