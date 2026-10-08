// Adapter Google (Gemini API) cho xưởng video: sinh ảnh (generateContent, responseModalities IMAGE) + sinh video Veo 3.1
// (predictLongRunning → poll operation → tải file). Gọi REST bằng fetch để không thêm dependency; khoá đọc server-side.
// Tên model Google đổi nhanh → `sinhAnh` thử lần lượt danh sách MO_HINH_ANH khi model được chọn trả 404.
import 'server-only';
import { MO_HINH_ANH, type DoPhanGiai, type TiLe } from './kieu';
import { sinhAnhOpenAI, khoaOpenAI } from './openai';

const GOC = 'https://generativelanguage.googleapis.com/v1beta';

export function khoaGoogle(): string | null {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null;
}

export type AnhVao = { mimeType: string; data: string };   // base64

/** Tải một URL (ảnh tham chiếu trên R2) về base64 để nhét vào request. Lỗi → bỏ qua ảnh đó, không chặn cả cảnh. */
export async function taiAnhBase64(url: string): Promise<AnhVao | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get('content-type')?.split(';')[0] || 'image/png';
    if (!mime.startsWith('image/')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 7_000_000) return null;
    return { mimeType: mime, data: buf.toString('base64') };
  } catch { return null; }
}

type KqAnh = { ok: true; model: string; mimeType: string; data: Buffer } | { ok: false; loi: string };

/** Gọi đúng MỘT model, không fallback (probe + sinhAnh dùng chung). Model không nhận imageSize thì thử lại không có. */
export async function sinhAnhMot(opts: { model: string; prompt: string; thamChieu?: AnhVao[]; tiLe: TiLe | '1:1'; kichCo?: '1K' | '2K' }): Promise<KqAnh> {
  const key = khoaGoogle();
  if (!key) return { ok: false, loi: 'Thiếu GOOGLE_API_KEY trên máy chủ' };
  const parts: Array<Record<string, unknown>> = [{ text: opts.prompt }];
  for (const a of (opts.thamChieu ?? []).slice(0, 14)) parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
  let loiCuoi = '';
  for (const coKichCo of [true, false]) {
    const imageConfig: Record<string, string> = { aspectRatio: opts.tiLe };
    if (coKichCo && opts.kichCo) imageConfig.imageSize = opts.kichCo;
    const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig } };
    const r = await fetch(`${GOC}/models/${opts.model}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      loiCuoi = docLoi(j, r.status);
      if (coKichCo && opts.kichCo && r.status === 400 && /imageSize|image_size|Unknown name/i.test(loiCuoi)) continue;
      return { ok: false, loi: loiCuoi };
    }
    const cands = (j.candidates as Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> }; finishReason?: string }> | undefined) ?? [];
    const inl = cands.flatMap((c) => c.content?.parts ?? []).find((p) => p.inlineData)?.inlineData;
    if (!inl) return { ok: false, loi: `model không trả ảnh (${cands[0]?.finishReason ?? 'không rõ'})` };
    return { ok: true, model: opts.model, mimeType: inl.mimeType || 'image/png', data: Buffer.from(inl.data, 'base64') };
  }
  return { ok: false, loi: loiCuoi };
}

/** Sinh MỘT ảnh với fallback: model được chọn không tồn tại (404) hoặc không có trong hạng free (quota 0) → thử model kế trong MO_HINH_ANH. */
export async function sinhAnh(opts: { model: string; prompt: string; thamChieu?: AnhVao[]; tiLe: TiLe | '1:1'; kichCo?: '1K' | '2K' }): Promise<KqAnh> {
  if (opts.model.startsWith('gpt-image')) return sinhAnhOpenAI({ prompt: opts.prompt, thamChieu: opts.thamChieu, tiLe: opts.tiLe, model: opts.model });
  const thuTu = [opts.model, ...MO_HINH_ANH.map((m) => m.key).filter((k) => k !== opts.model && !k.startsWith('gpt-image'))];
  let loiCuoi = '';
  for (const model of thuTu) {
    const kq = await sinhAnhMot({ ...opts, model });
    if (kq.ok) return kq;
    loiCuoi = `${model}: ${kq.loi}`;
    if (!/NOT_FOUND|404|RESOURCE_EXHAUSTED|limit: 0/i.test(kq.loi)) return { ok: false, loi: loiCuoi };
  }
  // Google hết đường (chưa billing → quota 0, hoặc đổi tên model) → OpenAI gpt-image nếu có khoá. Keyframe vẫn ra, Veo vẫn chờ billing Google.
  if (khoaOpenAI()) {
    const kq = await sinhAnhOpenAI({ prompt: opts.prompt, thamChieu: opts.thamChieu, tiLe: opts.tiLe });
    if (kq.ok) return kq;
    loiCuoi = `${loiCuoi} → ${kq.loi}`;
  }
  return { ok: false, loi: loiCuoi || 'không model ảnh nào chạy được' };
}

type KqVeoBatDau = { ok: true; taskId: string } | { ok: false; loi: string };

/** Bắt đầu sinh video Veo. Trả operation name để poll (`docVeo`). mode: text | start_image (keyframe làm khung đầu). */
export async function batDauVeo(opts: {
  model: string; prompt: string; anhDau?: AnhVao | null; anhCuoi?: AnhVao | null; tiLe: TiLe; doPhanGiai: DoPhanGiai; giay: 4 | 6 | 8;
}): Promise<KqVeoBatDau> {
  const key = khoaGoogle();
  if (!key) return { ok: false, loi: 'Thiếu GOOGLE_API_KEY trên máy chủ' };
  const inst: Record<string, unknown> = { prompt: opts.prompt };
  if (opts.anhDau) inst.image = { inlineData: opts.anhDau };
  if (opts.anhCuoi) inst.lastFrame = { inlineData: opts.anhCuoi };
  // 1080p bắt buộc 8s; ảnh đầu → personGeneration allow_adult (allow_all chỉ cho text-to-video).
  const giay = opts.doPhanGiai === '1080p' ? 8 : opts.giay;
  const parameters: Record<string, string> = {
    aspectRatio: opts.tiLe, resolution: opts.doPhanGiai, durationSeconds: String(giay),
    personGeneration: opts.anhDau ? 'allow_adult' : 'allow_all',
  };
  const r = await fetch(`${GOC}/models/${opts.model}:predictLongRunning`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ instances: [inst], parameters }),
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) return { ok: false, loi: docLoi(j, r.status) };
  const name = typeof j.name === 'string' ? j.name : '';
  return name ? { ok: true, taskId: name } : { ok: false, loi: 'Veo không trả operation name' };
}

type KqVeo = { done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string };

export async function docVeo(taskId: string): Promise<KqVeo> {
  const key = khoaGoogle();
  if (!key) return { done: true, ok: false, loi: 'Thiếu GOOGLE_API_KEY' };
  const r = await fetch(`${GOC}/${taskId}`, { headers: { 'x-goog-api-key': key } });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) return { done: true, ok: false, loi: docLoi(j, r.status) };
  if (!j.done) return { done: false };
  if (j.error) return { done: true, ok: false, loi: docLoi(j, 500) };
  const resp = j.response as { generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }>; raiMediaFilteredCount?: number; raiMediaFilteredReasons?: string[] } } | undefined;
  const uri = resp?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    const ly = resp?.generateVideoResponse?.raiMediaFilteredReasons?.join('; ');
    return { done: true, ok: false, loi: ly ? `Veo chặn nội dung: ${ly}` : 'Veo xong nhưng không có video' };
  }
  return { done: true, ok: true, uri };
}

/** Tải video từ URI của Veo (cần khoá trong header) về buffer để đẩy lên R2. */
export async function taiVeo(uri: string): Promise<Buffer | null> {
  const key = khoaGoogle();
  if (!key) return null;
  const r = await fetch(uri, { headers: { 'x-goog-api-key': key }, redirect: 'follow' });
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}

function docLoi(j: Record<string, unknown>, status: number): string {
  const e = j.error as { message?: string; status?: string } | undefined;
  const m = e?.message ?? '';
  // Lỗi hay gặp nhất: project của khoá chưa gắn Cloud Billing → ảnh/Veo bị quota free tier = 0. Nói thẳng nguyên nhân + cách sửa, không đổ nguyên đoạn tiếng Anh dài.
  if (status === 429 && /limit: 0|free_tier/i.test(m)) return 'Google chặn: project của GOOGLE_API_KEY chưa gắn Cloud Billing (ảnh/Veo không có trong free tier). Gắn billing ở aistudio.google.com/billing → Import projects.';
  if (status === 429) return 'Google báo vượt hạn mức gọi (rate limit) — đợi 1 phút rồi bấm lại.';
  return m ? `${e?.status ?? status}: ${m}`.slice(0, 300) : `HTTP ${status}`;
}
