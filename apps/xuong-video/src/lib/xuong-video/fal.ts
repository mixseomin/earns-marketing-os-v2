// Adapter fal.ai (một khoá, nhiều model video kể cả Trung Quốc). Queue: POST https://queue.fal.run/<model> → {request_id, status_url,
// response_url}; GET status_url tới COMPLETED; GET response_url → {video:{url}}. Header "Authorization: Key <FAL_KEY>" (đã kiểm 08/10/2026).
// Trường đầu vào theo trang API của từng model trên fal.ai (đọc 08/10/2026).
import 'server-only';

const QUEUE = 'https://queue.fal.run';
export const khoaFal = (): string | null => process.env.FAL_KEY || null;

type Vao = { prompt: string; anhDau: string; anhCuoi?: string | null; giay: number; tiLe: '9:16' | '16:9' };
/** Ánh xạ đầu vào chung → trường riêng của từng model fal. */
function dauVao(model: string, v: Vao): Record<string, unknown> {
  if (model.startsWith('fal-ai/kling-video/')) {
    return { prompt: v.prompt, start_image_url: v.anhDau, ...(v.anhCuoi ? { end_image_url: v.anhCuoi } : {}), duration: String(Math.min(15, Math.max(3, v.giay))), generate_audio: true };
  }
  if (model.startsWith('bytedance/seedance')) {
    return { prompt: v.prompt, image_url: v.anhDau, ...(v.anhCuoi ? { end_image_url: v.anhCuoi } : {}), duration: Math.min(30, Math.max(4, v.giay)), resolution: '720p', generate_audio: true };
  }
  if (model.startsWith('minimax/')) {
    return { prompt: v.prompt, image_url: v.anhDau, ...(v.anhCuoi ? { end_image_url: v.anhCuoi } : {}), duration: v.giay <= 6 ? 6 : 10, resolution: '768P' };
  }
  // vidu và model khác theo khuôn chung image_url + prompt + duration
  return { prompt: v.prompt, image_url: v.anhDau, duration: Math.min(16, Math.max(3, v.giay)) };
}

function docLoiFal(j: Record<string, unknown>, status: number): string {
  const d = j.detail;
  const m = typeof d === 'string' ? d : Array.isArray(d) ? JSON.stringify(d).slice(0, 240) : '';
  if (/Exhausted balance|locked/i.test(m)) return 'fal.ai hết tiền: tài khoản số dư $0 — nạp ở fal.ai/dashboard/billing rồi bấm lại.';
  return `fal ${status}: ${m || 'lỗi không rõ'}`.slice(0, 300);
}

export async function batDauFal(model: string, v: Vao): Promise<{ ok: true; taskId: string } | { ok: false; loi: string }> {
  const key = khoaFal();
  if (!key) return { ok: false, loi: 'Thiếu FAL_KEY trên máy chủ' };
  const r = await fetch(`${QUEUE}/${model}`, { method: 'POST', headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(dauVao(model, v)) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) return { ok: false, loi: docLoiFal(j, r.status) };
  if (typeof j.status_url !== 'string' || typeof j.response_url !== 'string') return { ok: false, loi: 'fal không trả status_url/response_url' };
  return { ok: true, taskId: JSON.stringify({ s: j.status_url, r: j.response_url }) };
}

export async function docFal(taskId: string): Promise<{ done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string }> {
  const key = khoaFal();
  if (!key) return { done: true, ok: false, loi: 'Thiếu FAL_KEY' };
  let t: { s: string; r: string };
  try { t = JSON.parse(taskId); } catch { return { done: true, ok: false, loi: 'task fal hỏng' }; }
  const h = { Authorization: `Key ${key}` };
  const st = await fetch(t.s, { headers: h });
  const sj = (await st.json().catch(() => ({}))) as { status?: string };
  if (!st.ok && st.status !== 202) return { done: true, ok: false, loi: docLoiFal(sj as Record<string, unknown>, st.status) };
  if (sj.status !== 'COMPLETED') return { done: false };
  const rr = await fetch(t.r, { headers: h });
  const rj = (await rr.json().catch(() => ({}))) as { video?: { url?: string } } & Record<string, unknown>;
  if (!rr.ok) return { done: true, ok: false, loi: docLoiFal(rj, rr.status) };
  return rj.video?.url ? { done: true, ok: true, uri: rj.video.url } : { done: true, ok: false, loi: 'fal xong nhưng không có video' };
}

/** Nâng cấp một clip có sẵn (giữ nguyên chuyển động) — Topaz Precision trên fal, video_url + upscale_factor. */
export async function batDauNangCap(model: string, videoUrl: string, heSo = 2): Promise<{ ok: true; taskId: string } | { ok: false; loi: string }> {
  const key = khoaFal();
  if (!key) return { ok: false, loi: 'Thiếu FAL_KEY trên máy chủ' };
  const r = await fetch(`${QUEUE}/${model}`, { method: 'POST', headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ video_url: videoUrl, upscale_factor: heSo }) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) return { ok: false, loi: docLoiFal(j, r.status) };
  if (typeof j.status_url !== 'string' || typeof j.response_url !== 'string') return { ok: false, loi: 'fal không trả status_url/response_url' };
  return { ok: true, taskId: JSON.stringify({ s: j.status_url, r: j.response_url }) };
}
