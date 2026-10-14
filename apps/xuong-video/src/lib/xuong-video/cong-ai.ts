// CỔNG AI GIÁ RẺ (15/10/2026 — anh: "nối vào studio có fallback sang các model ổn định; gen xong có thông tin nguồn, ngoài model").
// ckey.vn (chợ người bán, giá VNĐ) và ShopAIKey (credit $1 = 3.250₫) bán lại model Google/xAI rẻ hơn gọi thẳng. Một ảnh đi qua CHUỖI:
// cổng rẻ nhất trước, lỗi/treo/hết tiền thì sang cổng kế, cuối cùng mới tới Google — mỗi bước ghi vào `nguon` để biết ảnh ra từ đâu,
// giá thật bao nhiêu, bước nào hỏng vì sao. Số đo + bảng giá: scripts/du-lieu/cong-api/README.md. Chạy được trong Worker (không DB).
import type { TiLeAnh } from './kieu';

/** Tỉ giá quy tiền thật (memory feedback_chi_phi_vnd_that): sổ chi phí ghi cent USD theo VNĐ thật đã trả. */
export const VND_MOI_USD = 26000;
const vndRaCent = (vnd: number) => Math.round((vnd / VND_MOI_USD) * 100 * 1000) / 1000;

export type CongKey = 'ckey' | 'shopaikey' | 'google';
/** Thông tin nhà cung cấp — dùng cho tin báo hết tiền (tên, nơi nạp, vault giữ email/mật khẩu). */
export const CONG: Record<CongKey, { ten: string; napTien: string; vault: number | null; ghiChu: string }> = {
  ckey: { ten: 'CKEY.VN', napTien: 'https://ckey.vn/deposit', vault: 534, ghiChu: 'đăng nhập trên Chrome thường (Cloudflare chặn trình duyệt tự động); mã xác minh về Spam' },
  shopaikey: { ten: 'ShopAIKey', napTien: 'https://shopaikey.com/account', vault: 532, ghiChu: 'nạp xu rồi "Nạp thêm tiền" vào key hiện có' },
  google: { ten: 'Google AI Studio (Gemini API)', napTien: 'https://ai.studio/projects', vault: null, ghiChu: 'tín dụng trả trước của project gắn GOOGLE_API_KEY' },
};

export type BuocNguon = { cong: CongKey | 'fal' | 'openai'; model: string; ok: boolean; loi?: string; het_tien?: boolean; giay?: number };
/** Nguồn của MỘT lượt sinh: cổng + model đã gọi + model thật phía sau + người bán + tiền thật + các bước đã thử. */
export type NguonSinh = { cong: CongKey | 'fal' | 'openai'; model: string; model_that?: string; nguoi_ban?: string; vnd?: number; cents?: number; giay?: number; thu: BuocNguon[] };

const khoa = (k: CongKey) => (k === 'ckey' ? process.env.CKEY_API_KEY : k === 'shopaikey' ? process.env.SHOPAIKEY_API_KEY : process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) || null;
export const coCong = (k: CongKey) => !!khoa(k);

/** Lỗi kiểu HẾT TIỀN của từng cổng (để báo nạp, không phải lỗi model). */
export function laHetTien(cong: string, loi: string, status?: number): boolean {
  if (status === 402) return true;
  if (cong === 'google') return /prepayment credits|credits are depleted|billing account|chưa gắn Cloud Billing/i.test(loi);
  return /insufficient|not enough|quota (is )?(not enough|exhausted|exceeded)|balance|số dư|hết tiền|额度|余额|payment required/i.test(loi);
}

/** Bảng giá cổng (VNĐ thật / ảnh) — đo + đối chiếu console 15/10/2026. */
const GIA_ANH_VND: Record<string, number> = {
  'ckey:wowztools/nano-banana-2': 110.5, 'ckey:wowztools/nano-banana-pro': 110.5,
  'shopaikey:gemini-nano-banana-2.1': 683,
};

/** Chuỗi cổng cho một model ảnh Google (Nano Banana): rẻ + ổn định trước, Google trực tiếp cuối (sinhAnh lo). Chỉ cổng có khoá. */
export function chuoiAnh(modelGoogle: string): { cong: CongKey; model: string }[] {
  if (!/nano-banana|gemini.*image/i.test(modelGoogle)) return [];
  const ds: { cong: CongKey; model: string }[] = [
    { cong: 'ckey', model: 'wowztools/nano-banana-2' },        // → gemini-3.1-flash-image, 6/6 đạt 34–44s (15/10/2026)
    { cong: 'ckey', model: 'wowztools/nano-banana-pro' },      // → gemini-3.0-pro-image, cùng giá
    { cong: 'shopaikey', model: 'gemini-nano-banana-2.1' },    // 683₫, ~29s
  ];
  return ds.filter((x) => coCong(x.cong));
}

type KqAnhCong = { ok: true; data: Buffer; mimeType: string; modelThat?: string } | { ok: false; loi: string; status?: number };

async function taiVe(url: string): Promise<{ data: Buffer; mimeType: string } | null> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!r?.ok) return null;
  return { data: Buffer.from(await r.arrayBuffer()), mimeType: r.headers.get('content-type')?.split(';')[0] || 'image/png' };
}

/** Gọi MỘT cổng sinh ảnh. Ảnh tham chiếu đi bằng URL công khai (R2). Hết giờ chờ: ShopAIKey vẫn trừ tiền → chờ đủ lâu (240s). */
export async function sinhAnhCong(cong: CongKey, model: string, o: { prompt: string; thamChieuUrl: string[]; tiLe: TiLeAnh }): Promise<KqAnhCong> {
  const k = khoa(cong);
  if (!k) return { ok: false, loi: `thiếu khoá ${cong}` };
  const ref = o.thamChieuUrl.slice(0, 5);
  const [url, body, cho] = cong === 'ckey'
    ? ['https://api.xah.io/v1/images/generations', { model, prompt: o.prompt, size: o.tiLe, aspect_ratio: o.tiLe, n: 1, image_urls: ref, image: ref }, 180_000]
    : ['https://api.shopaikey.com/images/google/generations', { model, prompt: o.prompt, size: o.tiLe, imageSize: '1K', response_format: 'url', image_urls: ref }, 240_000];
  let r: Response;
  try {
    r = await fetch(url as string, { method: 'POST', headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(cho as number) });
  } catch (e) { return { ok: false, loi: `không nhận được trả lời (${e instanceof Error ? e.name : 'lỗi mạng'})` }; }
  const j = (await r.json().catch(() => ({}))) as { data?: { url?: string; b64_json?: string }[]; model?: string; error?: { message?: string } | string; message?: string };
  if (!r.ok) return { ok: false, status: r.status, loi: `HTTP ${r.status}: ${(typeof j.error === 'string' ? j.error : j.error?.message) || j.message || 'lỗi'}`.slice(0, 300) };
  const d = j.data?.[0];
  if (d?.b64_json) return { ok: true, data: Buffer.from(d.b64_json, 'base64'), mimeType: 'image/png', modelThat: j.model };
  if (d?.url) { const t = await taiVe(d.url); return t ? { ok: true, ...t, modelThat: j.model } : { ok: false, loi: 'không tải được ảnh cổng trả về' }; }
  return { ok: false, loi: 'cổng không trả ảnh' };
}

/** Thử lần lượt chuỗi cổng; trả ảnh + nguồn, hoặc null + các bước đã hỏng (sinhAnh nối tiếp sang Google). */
export async function sinhAnhQuaCong(modelGoogle: string, o: { prompt: string; thamChieuUrl: string[]; tiLe: TiLeAnh }): Promise<{ anh: { data: Buffer; mimeType: string } | null; nguon: NguonSinh | null; thu: BuocNguon[] }> {
  const thu: BuocNguon[] = [];
  for (const b of chuoiAnh(modelGoogle)) {
    const t0 = Date.now();
    const kq = await sinhAnhCong(b.cong, b.model, o);
    const giay = Math.round((Date.now() - t0) / 100) / 10;
    if (kq.ok) {
      const vnd = GIA_ANH_VND[`${b.cong}:${b.model}`];
      thu.push({ cong: b.cong, model: b.model, ok: true, giay });
      return { anh: kq, thu, nguon: { cong: b.cong, model: b.model, model_that: kq.modelThat, nguoi_ban: b.cong === 'ckey' ? b.model.split('/')[0] : undefined, vnd, cents: vnd != null ? vndRaCent(vnd) : undefined, giay, thu } };
    }
    thu.push({ cong: b.cong, model: b.model, ok: false, loi: kq.loi, het_tien: laHetTien(b.cong, kq.loi, kq.status), giay });
  }
  return { anh: null, nguon: null, thu };
}

const TEN_CONG: Record<string, string> = { ckey: 'ckey.vn', shopaikey: 'ShopAIKey', google: 'Google', fal: 'fal', openai: 'OpenAI' };
/** Một dòng nguồn để hiện cạnh ảnh/clip: "ckey.vn · wowztools/nano-banana-2 → gemini-3.1-flash-image · 110,5₫ · 39s". */
export function taNguon(n: NguonSinh | null | undefined): string {
  if (!n) return '';
  return [`${TEN_CONG[n.cong] ?? n.cong} · ${n.model}${n.model_that && n.model_that !== n.model ? ` → ${n.model_that}` : ''}`,
    n.vnd != null ? `${n.vnd.toLocaleString('vi-VN')}₫` : '', n.giay != null ? `${n.giay}s` : ''].filter(Boolean).join(' · ');
}
/** Các bước của chuỗi dự phòng: "ckey.vn wowztools/nano-banana-2 ✗ HTTP 502 → ShopAIKey ✓". */
export const taThu = (n: NguonSinh | null | undefined): string =>
  (n?.thu ?? []).map((b) => `${TEN_CONG[b.cong] ?? b.cong} ${b.model} ${b.ok ? '✓' : `✗ ${b.het_tien ? 'HẾT TIỀN · ' : ''}${(b.loi ?? '').slice(0, 80)}`}`).join(' → ');

// ── VIDEO qua cổng (ShopAIKey) ─────────────────────────────────────────────────────────────────────────────────────────────
// Đo 15/10/2026: Grok qua ShopAIKey ra clip trong ~95s (grok-video-3-10s 10s = 3.250₫, grok-imagine-video-1.5 6s = 6.500₫), clip 2:3 —
// bản xuất tự phóng + cắt cho đầy khung (xuat.ts). Veo của ShopAIKey treo hàng đợi >25 phút → KHÔNG đưa vào chuỗi; Google Veo trực tiếp
// là dự phòng cuối (sinh-video.ts). Task cổng treo quá TREO_PHUT phút chưa chạy → bỏ, sinh lại qua Google.
export const TREO_PHUT = 12;
const GIA_VIDEO_VND: Record<string, number> = { 'shopaikey:grok-video-3-10s': 3250, 'shopaikey:grok-imagine-video-1.5': 6500 };
export const giaVideoCong = (cong: string, model: string): { vnd?: number; cents?: number } => {
  const vnd = GIA_VIDEO_VND[`${cong}:${model}`];
  return vnd != null ? { vnd, cents: vndRaCent(vnd) } : {};
};

/** Chuỗi cổng video cho một shot dùng Veo (Google): Grok qua ShopAIKey trước. Chỉ khi có khoá. */
export function chuoiVideo(modelGoc: string): { cong: CongKey; model: string; giay: number }[] {
  if (!/^veo/i.test(modelGoc) || !coCong('shopaikey')) return [];
  return [{ cong: 'shopaikey', model: 'grok-video-3-10s', giay: 10 }, { cong: 'shopaikey', model: 'grok-imagine-video-1.5', giay: 6 }];
}

/** Gửi một task video lên cổng: khung đầu = keyframe (URL công khai). Trả task id hoặc lỗi (lỗi gửi = không tính tiền). */
export async function guiVideoCong(cong: CongKey, model: string, o: { prompt: string; anhDau: string; giay: number }): Promise<{ ok: true; taskId: string } | { ok: false; loi: string; status?: number }> {
  const k = khoa(cong);
  if (!k || cong !== 'shopaikey') return { ok: false, loi: `cổng ${cong} chưa có đường video` };
  try {
    const r = await fetch('https://api.shopaikey.com/v1/video/generations', {
      method: 'POST', headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ model, prompt: o.prompt, metadata: { images: [o.anhDau], aspect_ratio: '2:3', duration: o.giay, resolution: '720p' } }),
    });
    const j = (await r.json().catch(() => ({}))) as { task_id?: string; id?: string; error?: { message?: string }; message?: string };
    const id = j.task_id || j.id;
    if (!r.ok || !id) return { ok: false, status: r.status, loi: `HTTP ${r.status}: ${j.error?.message || j.message || 'không nhận task'}`.slice(0, 300) };
    return { ok: true, taskId: id };
  } catch (e) { return { ok: false, loi: `không gửi được (${e instanceof Error ? e.name : 'lỗi mạng'})` }; }
}

/** Hỏi trạng thái task cổng. treo = chưa chạy sau TREO_PHUT phút kể từ lúc gửi (tinh từ `taoLuc`). */
export async function docVideoCong(cong: string, taskId: string, taoLuc: string): Promise<{ done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string; treo?: boolean }> {
  const k = khoa(cong as CongKey);
  if (!k) return { done: true, ok: false, loi: `thiếu khoá ${cong}` };
  const r = await fetch(`https://api.shopaikey.com/v1/video/generations/${encodeURIComponent(taskId)}`, { headers: { authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!r?.ok) return { done: false };
  const d = ((await r.json().catch(() => ({}))) as { data?: { status?: string; result_url?: string; fail_reason?: string; start_time?: number } }).data ?? {};
  const st = String(d.status ?? '').toUpperCase();
  if (st === 'SUCCESS' && d.result_url) return { done: true, ok: true, uri: d.result_url };
  if (st === 'FAILURE' || st === 'FAILED') return { done: true, ok: false, loi: `cổng báo hỏng: ${d.fail_reason || 'không rõ'}` };
  if (!d.start_time && Date.now() - new Date(taoLuc).getTime() > TREO_PHUT * 60_000) return { done: true, ok: false, treo: true, loi: `treo hàng đợi ${TREO_PHUT} phút chưa chạy` };
  return { done: false };
}
