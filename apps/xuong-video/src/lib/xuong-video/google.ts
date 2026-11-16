// ẢNH + VEO của studio — mặt tiền giữ chữ ký cũ (sinhAnh / batDauVeo / docVeo / taiVeo) cho sinh-anh.ts, viec-anh.ts (Worker), sinh-video.ts, scripts.
// Từ 16/11/2026 MỌI lượt đi qua cổng AI chung (spy-on-tc/server/cong-anh.mjs · cong-media.mjs): studio không giữ khoá Google / OpenAI, không tự viết chuỗi dự phòng.
import 'server-only';
import { type DoPhanGiai, type TiLe, type TiLeAnh } from './kieu';
import { sinhAnhFal } from './fal';
import { tachKhoa, type NguonSinh } from './cong-ai';
import { sinhAnhMotCong, sinhAnhQuaCong } from './cong-ai-anh';
import { guiVideoCong, docVideoCong, taiVideoCong } from './cong-ai-video';

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

/** nguon: ảnh ra từ cổng nào, model thật, tiền thật, các bước đã thử (cong-ai.ts) — mọi lượt đi qua cổng AI chung. */
type KqAnh = { ok: true; model: string; mimeType: string; data: Buffer; nguon?: NguonSinh } | { ok: false; loi: string; nguon?: NguonSinh };

/** Gọi đúng MỘT model ảnh Google chính hãng qua cổng (ép cổng google), không fallback — scripts/thu-api.mts dò model. */
export async function sinhAnhMot(opts: { model: string; prompt: string; thamChieuUrl?: string[]; tiLe: TiLeAnh; kichCo?: '1K' | '2K' }): Promise<KqAnh> {
  const m = await sinhAnhMotCong('google', opts.model, { prompt: opts.prompt, thamChieuUrl: opts.thamChieuUrl ?? [], tiLe: opts.tiLe });
  return m.anh ? { ok: true, model: opts.model, mimeType: m.anh.mimeType, data: m.anh.data, nguon: m.nguon } : { ok: false, loi: `${opts.model}: ${m.loi}`, nguon: m.nguon };
}

/** Sinh MỘT ảnh — MỌI lượt qua cổng AI chung (anh 16/11/2026: một nguồn cho mọi model; studio không giữ khoá Google / OpenAI):
 *  'fal:<model>' → fal (qua cổng) · 'gpt-image…' → ép cổng openai · '<cổng>:<model>' → ép đúng cổng đó · 'google:<model>' → ép Google chính hãng ·
 *  model Google trần (Nano Banana…) → TỰ CHỌN theo chuỗi của cổng: ckey → ShopAIKey → lưới cuối Google → OpenAI (cong-anh.mjs).
 *  thamChieu base64 không còn dùng (cổng nhận URL công khai R2 — thamChieuUrl); giữ trong chữ ký cho nơi gọi cũ. */
export async function sinhAnh(opts: { model: string; prompt: string; thamChieu?: AnhVao[]; thamChieuUrl?: string[]; tiLe: TiLeAnh; kichCo?: '1K' | '2K' }): Promise<KqAnh> {
  const ref = opts.thamChieuUrl ?? [];
  // fal cần URL ảnh: tham chiếu đã là URL R2 công khai → truyền qua thamChieuUrl.
  if (opts.model.startsWith('fal:')) return sinhAnhFal(opts.model.slice(4), { prompt: opts.prompt, thamChieu: ref, tiLe: opts.tiLe });
  const k = tachKhoa(opts.model);
  const ep = opts.model.startsWith('gpt-image') ? { cong: 'openai' as const, model: opts.model } : k.kieu === 'cong' ? { cong: k.cong, model: k.model } : k.kieu === 'google' ? { cong: 'google' as const, model: k.model } : null;
  if (ep) {
    const m = await sinhAnhMotCong(ep.cong, ep.model, { prompt: opts.prompt, thamChieuUrl: ref, tiLe: opts.tiLe });
    return m.anh ? { ok: true, model: opts.model, mimeType: m.anh.mimeType, data: m.anh.data, nguon: m.nguon } : { ok: false, loi: `${opts.model}: ${m.loi}`, nguon: m.nguon };
  }
  const qc = await sinhAnhQuaCong(opts.model, { prompt: opts.prompt, thamChieuUrl: ref, tiLe: opts.tiLe });
  if (qc.anh && qc.nguon) return { ok: true, model: `${qc.nguon.cong}:${qc.nguon.model}`, mimeType: qc.anh.mimeType, data: qc.anh.data, nguon: qc.nguon };
  const loi = qc.thu.map((b) => b.loi).filter(Boolean).join(' → ') || 'không cổng ảnh nào chạy được';
  // IMAGE_SAFETY: Google chặn theo nội dung (vd người chỉ mặc đồ lót) — mọi model Google đều chặn như nhau, nên chỉ đường sang model khác.
  return { ok: false, loi: /SAFETY|PROHIBITED|BLOCK/i.test(loi) ? `${loi} — Google chặn ảnh này vì nội dung: đổi model ảnh sang fal (Seedream, FLUX Kontext…) ở ô chọn model cạnh nút rồi sinh lại` : loi,
    nguon: { cong: 'ckey', model: opts.model, thu: qc.thu } };
}

type KqVeoBatDau = { ok: true; taskId: string } | { ok: false; loi: string };

/** Bắt đầu sinh video Veo CHÍNH HÃNG qua cổng (ép cổng google, đúng model). Ảnh đi bằng URL công khai (cổng tải về, gửi bytesBase64Encoded). Trả operation name
 *  để hỏi lại bằng docVeo. loai = danh từ cần loại (negativePrompt). */
export async function batDauVeo(opts: {
  model: string; prompt: string; anhDau?: string | null; anhCuoi?: string | null; tiLe: TiLe; doPhanGiai: DoPhanGiai; giay: 4 | 6 | 8; loai?: string;
}): Promise<KqVeoBatDau> {
  if (!opts.anhDau) return { ok: false, loi: 'Veo qua cổng cần ảnh đầu (keyframe)' };
  const g = await guiVideoCong('google', opts.model, { prompt: opts.prompt, anhDau: opts.anhDau, anhCuoi: opts.anhCuoi ?? null, giay: opts.doPhanGiai === '1080p' ? 8 : opts.giay, tiLe: opts.tiLe, doPhanGiai: opts.doPhanGiai === '1080p' ? '1080p' : '720p', phuDinh: opts.loai ?? null });
  return g.ok ? { ok: true, taskId: g.taskId } : { ok: false, loi: g.loi };
}

type KqVeo = { done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string };

export async function docVeo(taskId: string): Promise<KqVeo> {
  const d = await docVideoCong('google', taskId, new Date().toISOString());
  return d.done ? (d.ok ? { done: true, ok: true, uri: d.uri } : { done: true, ok: false, loi: d.loi }) : { done: false };
}

/** Tải video Veo (link cần khoá) — cổng tải hộ. */
export async function taiVeo(uri: string): Promise<Buffer | null> { return taiVideoCong(uri); }
