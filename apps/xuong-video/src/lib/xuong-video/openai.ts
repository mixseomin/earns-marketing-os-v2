// Adapter OpenAI gpt-image: đường DỰ PHÒNG cho keyframe khi Google chưa có billing (quota ảnh free tier = 0, 08/10/2026).
// generations (không ảnh tham chiếu) hoặc edits (có ảnh tham chiếu: nhân vật/sản phẩm). Khoá đọc server-side (OPENAI_API_KEY).
// Giá (08/10/2026): gpt-image-1.5 1024² medium ≈ $0,034; gpt-image-1 medium ≈ $0,04. Veo KHÔNG có bản OpenAI (Sora 2 API đã đóng 24/09/2026).
import 'server-only';
import type { AnhVao } from './google';
import type { TiLe } from './kieu';

export const khoaOpenAI = (): string | null => process.env.OPENAI_API_KEY || null;

/** Thứ tự thử: model mới nhất trước; 404/invalid model → model kế. */
export const MO_HINH_ANH_OPENAI = ['gpt-image-1.5', 'gpt-image-1'] as const;

type Kq = { ok: true; model: string; mimeType: string; data: Buffer } | { ok: false; loi: string };

function kichCo(tiLe: TiLe | '1:1'): string {
  return tiLe === '9:16' ? '1024x1536' : tiLe === '16:9' ? '1536x1024' : '1024x1024';
}

export async function sinhAnhOpenAI(opts: { prompt: string; thamChieu?: AnhVao[]; tiLe: TiLe | '1:1'; model?: string }): Promise<Kq> {
  const key = khoaOpenAI();
  if (!key) return { ok: false, loi: 'Thiếu OPENAI_API_KEY trên máy chủ' };
  const thuTu = opts.model ? [opts.model, ...MO_HINH_ANH_OPENAI.filter((m) => m !== opts.model)] : [...MO_HINH_ANH_OPENAI];
  let loiCuoi = '';
  for (const model of thuTu) {
    let r: Response;
    if (opts.thamChieu?.length) {
      const fd = new FormData();
      fd.append('model', model); fd.append('prompt', opts.prompt); fd.append('size', kichCo(opts.tiLe)); fd.append('quality', 'medium'); fd.append('n', '1');
      for (const [i, a] of opts.thamChieu.slice(0, 8).entries()) {
        fd.append('image[]', new Blob([Buffer.from(a.data, 'base64')], { type: a.mimeType }), `ref${i}.${a.mimeType.split('/')[1] || 'png'}`);
      }
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
    } else {
      r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: opts.prompt, size: kichCo(opts.tiLe), quality: 'medium', n: 1 }),
      });
    }
    const j = (await r.json().catch(() => ({}))) as { data?: Array<{ b64_json?: string }>; error?: { message?: string; code?: string } };
    if (!r.ok) {
      loiCuoi = `openai ${model}: ${j.error?.message ?? `HTTP ${r.status}`}`.slice(0, 300);
      if (r.status === 404 || /model|not found|does not exist/i.test(j.error?.message ?? '')) continue;
      return { ok: false, loi: loiCuoi };
    }
    const b64 = j.data?.[0]?.b64_json;
    if (!b64) return { ok: false, loi: `openai ${model}: không trả ảnh` };
    return { ok: true, model, mimeType: 'image/png', data: Buffer.from(b64, 'base64') };
  }
  return { ok: false, loi: loiCuoi || 'không model OpenAI nào chạy được' };
}
