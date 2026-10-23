// Adapter fal.ai (một khoá, nhiều model video kể cả Trung Quốc). Queue: POST https://queue.fal.run/<model> → {request_id, status_url,
// response_url}; GET status_url tới COMPLETED; GET response_url → {video:{url}}. Header "Authorization: Key <FAL_KEY>" (đã kiểm 08/10/2026).
// Trường đầu vào theo trang API của từng model trên fal.ai (đọc 08/10/2026).
import 'server-only';
import { tomGia, type GiaTom } from './gia-fal';

const QUEUE = 'https://queue.fal.run';
export const khoaFal = (): string | null => process.env.FAL_KEY || null;

/** Trần ký tự prompt của model (theo trang API fal) — null = không giới hạn đáng kể. */
export const tranPrompt = (model: string): number | null => (/kling-video\//.test(model) ? 2500 : null);
type Vao = { prompt: string; anhDau: string; anhCuoi?: string | null; giay: number; tiLe: '9:16' | '16:9'; /** sinh kèm tiếng (mặc định có) */ tieng?: boolean };
/** Ánh xạ đầu vào chung → trường riêng của từng model fal. */
function dauVao(model: string, v: Vao): Record<string, unknown> {
  if (model.startsWith('fal-ai/kling-video/')) {
    return { prompt: v.prompt, start_image_url: v.anhDau, ...(v.anhCuoi ? { end_image_url: v.anhCuoi } : {}), duration: String(Math.min(15, Math.max(3, v.giay))), generate_audio: v.tieng ?? true };
  }
  if (model.startsWith('bytedance/seedance')) {
    return { prompt: v.prompt, image_url: v.anhDau, ...(v.anhCuoi ? { end_image_url: v.anhCuoi } : {}), duration: Math.min(30, Math.max(4, v.giay)), resolution: '720p', generate_audio: v.tieng ?? true };
  }
  if (model.startsWith('minimax/')) {
    return { prompt: v.prompt, image_url: v.anhDau, ...(v.anhCuoi ? { end_image_url: v.anhCuoi } : {}), duration: v.giay <= 6 ? 6 : 10, resolution: '768P' };
  }
  // vidu và model khác theo khuôn chung image_url + prompt + duration
  return { prompt: v.prompt, image_url: v.anhDau, duration: Math.min(16, Math.max(3, v.giay)) };
}

function docLoiFal(j: Record<string, unknown>, status: number): string {
  const d = j.detail;
  // 422 kiểu pydantic: [{type:'missing', loc:['body','image_urls'], msg}] → nói bằng tiếng Việt thiếu trường gì, không dán JSON.
  const ds = Array.isArray(d) ? (d as Array<{ type?: string; loc?: unknown[]; msg?: string }>) : [];
  const m = typeof d === 'string' ? d : ds.length ? ds.map((x) => `${x.type === 'missing' ? 'thiếu trường' : 'trường sai'} ${(x.loc ?? []).filter((y) => y !== 'body').join('.')}${x.type === 'missing' ? '' : ` (${x.msg ?? ''})`}`).join('; ') : '';
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
  const st = await fetch(t.s, { headers: h, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!st) return { done: false };   // mạng chập khi hỏi → coi như chưa xong, vòng sau hỏi lại
  const sj = (await st.json().catch(() => ({}))) as { status?: string };
  if (!st.ok && st.status !== 202) return { done: true, ok: false, loi: docLoiFal(sj as Record<string, unknown>, st.status) };
  if (sj.status !== 'COMPLETED') return { done: false };
  const rr = await fetch(t.r, { headers: h, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!rr) return { done: false };
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

/** Danh mục model fal (video image-to-video + ảnh edit) kèm giá đọc từ chuỗi giá của fal; nhớ 6 giờ. Có xuất để script nạp sổ nguồn dùng chung. */
export async function danhMucFal(): Promise<ModelFal[]> {
  if (khoDanhMuc && Date.now() - khoDanhMuc.luc < 6 * 3600_000) return khoDanhMuc.ds;
  // Đọc HẾT các trang (mỗi trang tối đa 100): trước 16/10/2026 chỉ đọc trang đầu → 100 / 329 model video, ô chọn model + sổ nguồn thiếu phần lớn.
  const lay = async (cat: string) => {
    const out: Array<Record<string, unknown>> = [];
    for (let trang = 1; trang <= 10; trang++) {
      try {
        const r = await fetch(`https://fal.ai/api/models?categories=${cat}&limit=100&page=${trang}`, { headers: { accept: 'application/json' } });
        const it = ((await r.json()) as { items?: Array<Record<string, unknown>> }).items ?? [];
        out.push(...it);
        if (it.length < 100) break;
      } catch (e) { console.error(`danh mục fal ${cat} trang ${trang}:`, e); break; }
    }
    return out;
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

/** MỘT model fal theo id: tìm trong danh mục; KHÔNG có (danh mục fal không liệt kê mọi model — Veo 3.1 Lite không nằm trong 196 model
 *  image-to-video) thì đọc chuỗi giá từ trang của chính model (pricingInfoOverride nhúng trong HTML), nhớ 6 giờ. Trước đây rơi về giá dự
 *  phòng: sổ ghi $0,40/clip 4s trong khi fal thu $0,12 (14/10/2026, tập 1 Tango & Lint ghi $8 thay vì $2,40). */
const khoRieng = new Map<string, { luc: number; m: ModelFal | null }>();
export async function modelFal(id: string): Promise<ModelFal | null> {
  const coSan = (await danhMucFal()).find((x) => x.id === id);
  if (coSan) return coSan;
  const c = khoRieng.get(id);
  if (c && Date.now() - c.luc < 6 * 3600_000) return c.m;
  let m: ModelFal | null = null;
  try {
    const r = await fetch(`https://fal.ai/models/${id}/api`, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000) });
    const t = await r.text();
    const k = /pricingInfoOverride\\?":\\?"((?:[^"\\]|\\.)*?)\\?"/.exec(t);
    if (k) {
      const gt = k[1]!.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\n/g, '\n');
      const gia = tomGia(gt);
      m = { id, ten: id, loai: /video|pikaframes|frames-to/.test(id) ? 'video' : 'anh', giaText: gia.moTa, giaCents: gia.chinh['720p'], donVi: gia.chinh['720p'] != null ? 'giay' : 'khac', gia };
    }
  } catch (e) { console.error('[fal] không đọc được giá model', id, e); }
  khoRieng.set(id, { luc: Date.now(), m });
  return m;
}

type SchemaTruong = { type?: string; enum?: unknown[]; default?: unknown; anyOf?: Array<{ type?: string; enum?: unknown[] }>; items?: unknown };
const khoSchema = new Map<string, Record<string, SchemaTruong>>();
const khoBatBuoc = new Map<string, string[]>();
async function schemaVao(id: string): Promise<Record<string, SchemaTruong>> {
  if (khoSchema.has(id)) return khoSchema.get(id)!;
  try {
    const r = await fetch(`https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(id)}`);
    const j = (await r.json()) as { components?: { schemas?: Record<string, { properties?: Record<string, SchemaTruong>; required?: string[] }> } };
    const sc = j.components?.schemas ?? {};
    const k = Object.keys(sc).find((x) => /Input$/.test(x)) ?? Object.keys(sc)[0];
    const props = (k && sc[k]?.properties) || {};
    khoSchema.set(id, props);
    khoBatBuoc.set(id, (k && sc[k]?.required) || []);
    return props;
  } catch (e) { console.error('[fal] đọc OpenAPI', id, e); return {}; }
}
/** Endpoint có tồn tại và có BẮT BUỘC ảnh đầu vào không (model sửa ảnh). Không tồn tại → null. */
async function canAnh(id: string): Promise<boolean | null> {
  const p = await schemaVao(id);
  if (!Object.keys(p).length) return null;
  return (khoBatBuoc.get(id) ?? []).some((f) => /image/.test(f));
}
const enumCua = (f?: SchemaTruong) => (f?.enum ?? f?.anyOf?.flatMap((a) => a.enum ?? []) ?? []) as unknown[];

/** Đầu vào chung → đúng tên/kiểu trường của endpoint fal, đọc từ OpenAPI. */
/** Cắt chữ về ≤ toiDa ký tự ở ranh giới câu (không có giới hạn → giữ nguyên). Thuần. */
export function catCau(chu: string, toiDa?: number): string {
  if (!toiDa || chu.length <= toiDa) return chu;
  const cat = chu.slice(0, toiDa); const i = Math.max(cat.lastIndexOf('. '), cat.lastIndexOf('.\n'));
  return (i > toiDa * 0.5 ? cat.slice(0, i + 1) : cat.slice(0, cat.lastIndexOf(' '))).trim();
}

export async function dauVaoTheoSchema(id: string, v: { prompt: string; anhDau?: string | null; anhCuoi?: string | null; /** khung khoá giữa (model nhiều khung: Pikaframes) */ khungGiua?: string[]; /** clip diễn Blender cả shot (model 3D→video: H3 Max) */ videoNguon?: string | null; anhThamChieu?: string[]; giay?: number; tiLe?: string; tieng?: boolean; /** danh từ cần loại (negative prompt) */ loai?: string }): Promise<Record<string, unknown>> {
  const p = await schemaVao(id);
  const co = (k: string) => k in p;
  // Độ dài prompt theo GIỚI HẠN CỦA CHÍNH MODEL (schema maxLength): Kling 2.1 Pro nhận ≤ 2500 ký tự → 422 (#23, 16/10/2026). Cắt ở ranh giới câu
  // — các câu giữ ảnh / cấm chữ / hành động đứng đầu prompt nên phần mất là đuôi (kỹ thuật máy, cảm xúc).
  const toiDa = (p.prompt as { maxLength?: number } | undefined)?.maxLength;
  const o: Record<string, unknown> = { prompt: catCau(v.prompt, toiDa) };
  const truongDau = ['start_image_url', 'image_url', 'first_frame_url', 'first_image_url', 'image'].find(co);
  const truongCuoi = ['end_image_url', 'tail_image_url', 'last_frame_url', 'end_frame_url', 'last_image_url'].find(co);
  // NHIỀU KHUNG KHOÁ (Pikaframes: image_urls 2–5 + transitions): đầu → các khung giữa → cuối, chia đều số giây shot cho từng đoạn (≥ 1 s mỗi đoạn).
  const khung = [v.anhDau, ...(v.khungGiua ?? []), v.anhCuoi].filter((x): x is string => !!x);
  // CLIP 3D LÀM NGUỒN (H3 Max 3D→Video: video_url = clip diễn Blender): máy / đường đi / nhịp / số vật lấy từ clip; các khung khoá làm ảnh tham chiếu
  // ngoại hình (có tham chiếu thì model không tự sinh ảnh ngoại hình mới). Thời lượng theo clip.
  if (co('video_url') && v.videoNguon) {
    // H3 Max kiểm prompt ≤ 2000 ký tự LÚC CHẠY (schema không khai maxLength, lỗi 422 về qua docFal chứ không lúc gửi — #23 16/10/2026).
    o.video_url = v.videoNguon; o.prompt = catCau(v.prompt, toiDa ?? 2000);
    if (khung.length && co('reference_image_urls')) o.reference_image_urls = khung.slice(0, 8);
    if (co('resolution')) { const en = enumCua(p.resolution).map(String); const chon = en.find((x) => /768|720/.test(x)) ?? en[0]; if (chon) o.resolution = chon; }
    return o;
  }
  // CLIP DIỄN BLENDER LÀM KHUÔN CHUYỂN ĐỘNG (reference-to-video: video_urls + image_urls — Seedance 2.0; anh 23/10/2026 "tìm xem họ đang làm thế nào": ngành
  // đưa video dựng thô 3D làm tham chiếu chuyển động thay vì tả động tác bằng chữ — flick.art/blog/blender-ai-filmmaking). Ảnh đầu đã duyệt = ngoại hình +
  // sảnh; clip = chỉ chuyển động / chỗ đứng / nhịp / máy, KHÔNG lấy vẻ ma-nơ-canh xám.
  if (co('video_urls') && co('image_urls') && v.videoNguon && v.anhDau) {
    o.image_urls = [v.anhDau]; o.video_urls = [v.videoNguon];
    o.prompt = catCau(`@Image1 is the first frame of this shot: keep exactly these people, faces, hair, wardrobe, the set, lighting, colours and framing. @Video1 is a rough 3D blockout of this same shot: copy ONLY its movement — where each person moves, their poses, gestures, timing and the camera move — never its grey mannequin look, colours or materials. ${v.prompt}`, toiDa);
    const en = enumCua(p.duration).map(String).filter((x) => /^\d+$/.test(x)).map(Number);
    if (en.length) o.duration = String(en.reduce((a, b) => (Math.abs(b - (v.giay ?? 5)) < Math.abs(a - (v.giay ?? 5)) ? b : a)));
    if (v.tiLe && co('aspect_ratio')) o.aspect_ratio = enumCua(p.aspect_ratio).map(String).includes(v.tiLe) ? v.tiLe : 'auto';
    if (co('resolution')) o.resolution = '720p';
    if (co('generate_audio')) o.generate_audio = v.tieng ?? false;
    return o;
  }
  // KHUNG GHIM THEO SỐ KHUNG (FLUX 3 keyframes: [{image_url, frame_index}] trên video 24 khung/giây, ≤ 10 khung): rải đều từ khung 0 tới khung cuối.
  if (co('keyframes') && khung.length >= 2) {
    const en = enumCua(p.duration).map(Number).filter((x) => !Number.isNaN(x));
    const dur = en.length ? en.reduce((a, b) => (Math.abs(b - (v.giay ?? 5)) < Math.abs(a - (v.giay ?? 5)) ? b : a)) : Math.max(5, Math.round(v.giay ?? 5));
    const ds = khung.slice(0, 10); const cuoi = dur * 24 - 1;
    o.keyframes = ds.map((u, i) => ({ image_url: u, frame_index: Math.round((i / (ds.length - 1)) * cuoi) }));
    o.duration = dur;
    if (co('generate_audio')) o.generate_audio = v.tieng ?? false;
    if (v.tiLe && co('aspect_ratio')) o.aspect_ratio = enumCua(p.aspect_ratio).map(String).includes(v.tiLe) ? v.tiLe : 'auto';
    if (co('resolution')) o.resolution = '720p';
    return o;
  }
  if (co('transitions') && co('image_urls') && khung.length >= 2) {
    const n = khung.length - 1; const tong = Math.max(n, Math.round(v.giay ?? 5)); const d = Array.from({ length: n }, (_, i) => Math.floor(tong / n) + (i < tong % n ? 1 : 0));
    o.image_urls = khung.slice(0, 5); o.transitions = d.slice(0, Math.min(5, khung.length) - 1).map((x) => ({ duration: x }));
    if (co('resolution')) o.resolution = '720p';
    if (v.loai && co('negative_prompt')) o.negative_prompt = v.loai;
    return o;
  }
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
  // Tiếng clip chỉ dùng khi shot có người nói trong khung (dungTiengClip) — còn lại tắt hẳn, Veo khỏi bịa giọng/nhạc (10/10/2026).
  if (co('generate_audio')) o.generate_audio = v.tieng ?? true;
  if (v.loai && co('negative_prompt')) o.negative_prompt = v.loai;
  return o;
}

/** Gửi job fal bất kỳ (đầu vào đã ánh xạ). */
export async function guiFal(id: string, input: Record<string, unknown>): Promise<{ ok: true; taskId: string } | { ok: false; loi: string }> {
  const key = khoaFal();
  if (!key) return { ok: false, loi: 'Thiếu FAL_KEY trên máy chủ' };
  // Lỗi MẠNG (đứt kết nối) không được văng ra: lần gửi Pikaframes #23 (16/10/2026) đổ cả script sinh-shot ở đây. Lỗi gửi = chưa tính tiền.
  let r: Response;
  try { r = await fetch(`${QUEUE}/${id}`, { method: 'POST', headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(60_000) }); }
  catch (e) { return { ok: false, loi: `không gửi được tới fal (${e instanceof Error ? e.name : 'lỗi mạng'}) — thử lại` }; }
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  // Prompt dài hơn giới hạn mà schema KHÔNG khai maxLength (H3 Max 3D→Video: 2000 ký tự, #23 16/10/2026) → fal 422 nói rõ số → cắt ở ranh giới câu
  // đúng số đó rồi gửi lại MỘT lần. Lỗi 422 chưa tính tiền.
  if (r.status === 422 && typeof input.prompt === 'string') {
    const d = Array.isArray(j.detail) ? (j.detail as Array<{ loc?: unknown[]; msg?: string }>) : [];
    const n = Number(/at most (\d+) characters/.exec(d.find((x) => (x.loc ?? []).includes('prompt'))?.msg ?? '')?.[1]);
    if (n && input.prompt.length > n) return guiFal(id, { ...input, prompt: catCau(input.prompt, n) });
  }
  if (!r.ok) return { ok: false, loi: docLoiFal(j, r.status) };
  if (typeof j.status_url !== 'string' || typeof j.response_url !== 'string') return { ok: false, loi: 'fal không trả status_url/response_url' };
  return { ok: true, taskId: JSON.stringify({ s: j.status_url, r: j.response_url }) };
}

/** Ảnh qua fal (model edit, có ảnh tham chiếu) — chờ tới xong (chạy trong hàng đợi nền nên chờ được). */
export async function sinhAnhFal(id0: string, v: { prompt: string; thamChieu: string[]; tiLe: string }): Promise<{ ok: true; model: string; mimeType: string; data: Buffer } | { ok: false; loi: string }> {
  // Model SỬA ảnh (bắt buộc ảnh đầu vào) mà chưa có ảnh tham chiếu (vd ảnh gốc đầu tiên) → dùng bản sinh-từ-chữ cùng dòng
  // (…/edit → …/text-to-image). Không có bản đó thì báo rõ, không gửi để nhận 422 (#1216).
  let id = id0;
  if (!v.thamChieu.length && (await canAnh(id0))) {
    const goc = id0.replace(/\/(edit|image-to-image|edit-image)$/, '');
    let thay: string | null = null;
    for (const c of [`${goc}/text-to-image`, goc]) { if (c !== id0 && (await canAnh(c)) === false) { thay = c; break; } }
    if (!thay) return { ok: false, loi: `Model ${id0} chỉ SỬA ảnh (cần ảnh đầu vào) mà chưa có ảnh tham chiếu nào. Ảnh gốc đầu tiên: chọn model sinh từ chữ (Nano Banana, GPT Image, Seedream text-to-image…); có ảnh rồi mới dùng model sửa ảnh.` };
    id = thay;
  }
  const input = await dauVaoTheoSchema(id, { prompt: v.prompt, anhThamChieu: v.thamChieu, tiLe: v.tiLe });
  return chayAnhFal(id, input);
}

/** Gửi một việc ẢNH lên fal với đầu vào dựng sẵn rồi chờ tới xong (≤ 3 phút) — dùng chung cho sinhAnhFal và bước độ sâu của keyframe hai bước
 *  (control_image_url không nằm trong khuôn chung của dauVaoTheoSchema). */
export async function chayAnhFal(id: string, input: Record<string, unknown>, o: { /** SAM 3: tải MỌI mặt nạ (j.masks) vào `ds` */ masks?: boolean } = {}): Promise<{ ok: true; model: string; mimeType: string; data: Buffer; ds?: Buffer[] } | { ok: false; loi: string }> {
  const g = await guiFal(id, input);
  if (!g.ok) return g;
  const t = JSON.parse(g.taskId) as { s: string; r: string };
  const h = { Authorization: `Key ${khoaFal()}` };
  // MỌI lần gọi mạng sau khi gửi cũng không được văng ra (17/10/2026: hỏi trạng thái gặp ConnectTimeout → đổ cả lượt sinh-anh-phim 10 shot, 4 job treo):
  // hỏi trạng thái lỗi mạng thì hỏi lại lượt sau (tối đa 5 lần liền); tải kết quả / ảnh lỗi mạng thì thử lại 3 lần rồi trả lỗi thường.
  const lay = async (u: string, lan = 3): Promise<Response | null> => { for (let i = 0; i < lan; i++) { try { return await fetch(u, { headers: u.startsWith('https://queue.fal.run') ? h : undefined, signal: AbortSignal.timeout(30_000) }); } catch { await new Promise((o) => setTimeout(o, 2000)); } } return null; };
  let loiMang = 0;
  // CHỜ 8 PHÚT (18/10/2026: FLUX pro depth đo 2–3 phút giờ cao điểm; cắt ở 3 phút thì fal vẫn chạy xong và vẫn tính tiền, sổ không ghi)
  for (let i = 0; i < 240; i++) {
    await new Promise((o) => setTimeout(o, 2000));
    const rs = await lay(t.s, 1); if (!rs) { if (++loiMang >= 5) return { ok: false, loi: 'mất kết nối fal khi chờ kết quả (5 lần liền) — job đã gửi, xem lại trên fal' }; continue; }
    loiMang = 0;
    const st = (await rs.json().catch(() => ({}))) as { status?: string };
    if (st.status !== 'COMPLETED') continue;
    const rr = await lay(t.r); if (!rr) return { ok: false, loi: 'fal xong nhưng không tải được kết quả (lỗi mạng)' };
    const j = (await rr.json().catch(() => ({}))) as { images?: Array<{ url?: string; content_type?: string }>; image?: { url?: string }; masks?: Array<{ url?: string }>; detail?: unknown };
    if (!rr.ok) return { ok: false, loi: docLoiFal(j as Record<string, unknown>, rr.status) };
    if (o.masks) {   // không có mặt nạ nào = không thấy vật đó (hợp lệ, không phải lỗi)
      const ds: Buffer[] = [];
      for (const m of j.masks ?? []) { const b = m.url ? await lay(m.url) : null; if (b) ds.push(Buffer.from(await b.arrayBuffer())); }
      return { ok: true, model: `fal:${id}`, mimeType: 'image/png', data: ds[0] ?? Buffer.alloc(0), ds };
    }
    const url = j.images?.[0]?.url ?? j.image?.url;
    if (!url) return { ok: false, loi: 'fal xong nhưng không có ảnh' };
    const b = await lay(url); if (!b) return { ok: false, loi: 'fal xong nhưng không tải được ảnh (lỗi mạng)' };
    return { ok: true, model: `fal:${id}`, mimeType: b.headers.get('content-type')?.split(';')[0] || 'image/png', data: Buffer.from(await b.arrayBuffer()) };
  }
  return { ok: false, loi: `fal quá 8 phút chưa xong — yêu cầu vẫn chạy và có thể tính tiền, tra: ${t.r}` };
}
