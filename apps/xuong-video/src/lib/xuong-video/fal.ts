// Adapter fal.ai (một khoá, nhiều model video kể cả Trung Quốc). Queue: POST https://queue.fal.run/<model> → {request_id, status_url,
// response_url}; GET status_url tới COMPLETED; GET response_url → {video:{url}}. Header "Authorization: Key <FAL_KEY>" (đã kiểm 08/10/2026).
// Trường đầu vào theo trang API của từng model trên fal.ai (đọc 08/10/2026).
import 'server-only';
import { tomGia, type GiaTom } from './gia-fal';

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

// ── Danh mục model fal (động) + ánh xạ đầu vào theo OpenAPI của từng endpoint ─────────────────────────────────────
// Anh muốn chọn được nhiều model (08/10/2026). fal có API danh mục công khai (id, tên, mô tả giá) và OpenAPI theo endpoint →
// không phải viết tay từng model: tên trường ảnh đầu/cuối, thời lượng, độ phân giải đọc từ schema.

export type ModelFal = { id: string; ten: string; loai: 'video' | 'anh'; giaText: string; giaCents: number | null; donVi: 'giay' | 'anh' | 'khac'; gia: GiaTom };
let khoDanhMuc: { luc: number; ds: ModelFal[] } | null = null;

/** Giá đầu tiên trong mô tả giá của fal → cents theo đơn vị (giây / ảnh). Không đoán được thì null (UI ghi "xem fal"). */
function docGia(t: string): { cents: number | null; donVi: ModelFal['donVi'] } {
  const m = t.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return { cents: null, donVi: 'khac' };
  const v = parseFloat(m[1]!) * 100;
  const sau = t.slice((m.index ?? 0), (m.index ?? 0) + 80).toLowerCase();
  if (/per\s+second|\/\s*s(ec)?\b|each second|every second|per video second/.test(sau)) return { cents: v, donVi: 'giay' };
  if (/per\s+(image|megapixel|generation|request)|\/\s*image/.test(sau)) return { cents: v, donVi: 'anh' };
  return { cents: v, donVi: 'khac' };
}

export async function danhMucFal(): Promise<ModelFal[]> {
  if (khoDanhMuc && Date.now() - khoDanhMuc.luc < 6 * 3600_000) return khoDanhMuc.ds;
  const lay = async (cat: string) => {
    try {
      const r = await fetch(`https://fal.ai/api/models?categories=${cat}&limit=100`, { headers: { accept: 'application/json' } });
      const j = (await r.json()) as { items?: Array<Record<string, unknown>> };
      return j.items ?? [];
    } catch { return []; }
  };
  const [vid, anh] = await Promise.all([lay('image-to-video'), lay('image-to-image')]);
  const ds: ModelFal[] = [];
  for (const m of vid) {
    const id = String(m.id ?? '');
    if (!/image-to-video|first-last-frame/.test(id) || /avatar|lip-sync|omnihuman|heygen|fabric/.test(id)) continue;
    const gt = String(m.pricingInfoOverride ?? '');
    const gia = tomGia(gt);
    ds.push({ id, ten: String(m.title ?? id), loai: 'video', giaText: gia.moTa, giaCents: gia.chinh['720p'], donVi: gia.chinh['720p'] != null ? 'giay' : 'khac', gia });
  }
  for (const m of anh) {
    const id = String(m.id ?? '');
    if (!/\/edit\b|kontext|edit-image/.test(id) || /remove|upscale|eraser|fill|expand|vectorize|depth|sam-/.test(id)) continue;
    const gt = String(m.pricingInfoOverride ?? '');
    const g = docGia(gt);
    const gia = tomGia(gt);
    ds.push({ id, ten: String(m.title ?? id), loai: 'anh', giaText: gia.moTa, giaCents: gia.anh?.[0] ?? g.cents, donVi: 'anh', gia });
  }
  if (ds.length) khoDanhMuc = { luc: Date.now(), ds };
  return ds.length ? ds : khoDanhMuc?.ds ?? [];
}

type SchemaTruong = { type?: string; enum?: unknown[]; default?: unknown; anyOf?: Array<{ type?: string; enum?: unknown[] }>; items?: unknown };
const khoSchema = new Map<string, Record<string, SchemaTruong>>();
async function schemaVao(id: string): Promise<Record<string, SchemaTruong>> {
  if (khoSchema.has(id)) return khoSchema.get(id)!;
  try {
    const r = await fetch(`https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(id)}`);
    const j = (await r.json()) as { components?: { schemas?: Record<string, { properties?: Record<string, SchemaTruong> }> } };
    const sc = j.components?.schemas ?? {};
    const k = Object.keys(sc).find((x) => /Input$/.test(x)) ?? Object.keys(sc)[0];
    const props = (k && sc[k]?.properties) || {};
    khoSchema.set(id, props);
    return props;
  } catch (e) { console.error('[fal] đọc OpenAPI', id, e); return {}; }
}
const enumCua = (f?: SchemaTruong) => (f?.enum ?? f?.anyOf?.flatMap((a) => a.enum ?? []) ?? []) as unknown[];

/** Đầu vào chung → đúng tên/kiểu trường của endpoint fal, đọc từ OpenAPI. */
export async function dauVaoTheoSchema(id: string, v: { prompt: string; anhDau?: string | null; anhCuoi?: string | null; anhThamChieu?: string[]; giay?: number; tiLe?: string }): Promise<Record<string, unknown>> {
  const p = await schemaVao(id);
  const co = (k: string) => k in p;
  const o: Record<string, unknown> = { prompt: v.prompt };
  const truongDau = ['start_image_url', 'image_url', 'first_frame_url', 'first_image_url', 'image'].find(co);
  const truongCuoi = ['end_image_url', 'tail_image_url', 'last_frame_url', 'end_frame_url', 'last_image_url'].find(co);
  if (v.anhDau && truongDau) o[truongDau] = v.anhDau;
  if (v.anhCuoi && truongCuoi) o[truongCuoi] = v.anhCuoi;
  const ds = v.anhThamChieu?.filter(Boolean) ?? [];
  if (ds.length && co('image_urls')) o.image_urls = ds.slice(0, 10);
  else if (ds.length && !v.anhDau && co('image_url')) o.image_url = ds[0];
  if (v.giay && co('duration')) {
    const f = p.duration!; const en = enumCua(f);
    if (en.length) {
      const so = en.map((x) => ({ x, n: parseFloat(String(x)) })).filter((a) => !Number.isNaN(a.n));
      const gan = so.sort((a, b) => Math.abs(a.n - v.giay!) - Math.abs(b.n - v.giay!))[0];
      if (gan) o.duration = gan.x;
    } else o.duration = f.type === 'string' ? String(v.giay) : v.giay;
  }
  if (co('resolution')) {
    const en = enumCua(p.resolution).map(String);
    const chon = en.find((x) => /720/.test(x)) ?? en.find((x) => /768/.test(x)) ?? en.find((x) => /1080/.test(x));
    if (chon) o.resolution = chon;
  }
  if (v.tiLe && co('aspect_ratio')) {
    const en = enumCua(p.aspect_ratio).map(String);
    if (!en.length || en.includes(v.tiLe)) o.aspect_ratio = v.tiLe; else if (en.includes('auto')) o.aspect_ratio = 'auto';
  }
  if (co('generate_audio')) o.generate_audio = true;
  return o;
}

/** Gửi job fal bất kỳ (đầu vào đã ánh xạ). */
export async function guiFal(id: string, input: Record<string, unknown>): Promise<{ ok: true; taskId: string } | { ok: false; loi: string }> {
  const key = khoaFal();
  if (!key) return { ok: false, loi: 'Thiếu FAL_KEY trên máy chủ' };
  const r = await fetch(`${QUEUE}/${id}`, { method: 'POST', headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) return { ok: false, loi: docLoiFal(j, r.status) };
  if (typeof j.status_url !== 'string' || typeof j.response_url !== 'string') return { ok: false, loi: 'fal không trả status_url/response_url' };
  return { ok: true, taskId: JSON.stringify({ s: j.status_url, r: j.response_url }) };
}

/** Ảnh qua fal (model edit, có ảnh tham chiếu) — chờ tới xong (chạy trong hàng đợi nền nên chờ được). */
export async function sinhAnhFal(id: string, v: { prompt: string; thamChieu: string[]; tiLe: string }): Promise<{ ok: true; model: string; mimeType: string; data: Buffer } | { ok: false; loi: string }> {
  const input = await dauVaoTheoSchema(id, { prompt: v.prompt, anhThamChieu: v.thamChieu, tiLe: v.tiLe });
  const g = await guiFal(id, input);
  if (!g.ok) return g;
  const t = JSON.parse(g.taskId) as { s: string; r: string };
  const h = { Authorization: `Key ${khoaFal()}` };
  for (let i = 0; i < 90; i++) {
    await new Promise((o) => setTimeout(o, 2000));
    const st = (await (await fetch(t.s, { headers: h })).json().catch(() => ({}))) as { status?: string };
    if (st.status !== 'COMPLETED') continue;
    const rr = await fetch(t.r, { headers: h });
    const j = (await rr.json().catch(() => ({}))) as { images?: Array<{ url?: string; content_type?: string }>; image?: { url?: string }; detail?: unknown };
    if (!rr.ok) return { ok: false, loi: docLoiFal(j as Record<string, unknown>, rr.status) };
    const url = j.images?.[0]?.url ?? j.image?.url;
    if (!url) return { ok: false, loi: 'fal xong nhưng không có ảnh' };
    const b = await fetch(url);
    return { ok: true, model: `fal:${id}`, mimeType: b.headers.get('content-type')?.split(';')[0] || 'image/png', data: Buffer.from(await b.arrayBuffer()) };
  }
  return { ok: false, loi: 'fal quá 3 phút chưa xong' };
}
