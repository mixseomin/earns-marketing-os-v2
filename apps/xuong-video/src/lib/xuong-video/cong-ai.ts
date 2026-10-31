// CỔNG AI GIÁ RẺ (15/10/2026 — anh: "nối vào studio có fallback sang các model ổn định; gen xong có thông tin nguồn, ngoài model").
// ckey.vn (chợ người bán, giá VNĐ) và ShopAIKey (credit $1 = 3.250₫) bán lại model Google/xAI rẻ hơn gọi thẳng. Một ảnh đi qua CHUỖI:
// cổng rẻ nhất trước, lỗi/treo/hết tiền thì sang cổng kế, cuối cùng mới tới Google — mỗi bước ghi vào `nguon` để biết ảnh ra từ đâu,
// giá thật bao nhiêu, bước nào hỏng vì sao. Số đo + bảng giá: scripts/du-lieu/cong-api/README.md. Chạy được trong Worker (không DB).
import { hopQc, type TiLeAnh } from './kieu';

/** Tỉ giá quy tiền thật (memory feedback_chi_phi_vnd_that): sổ chi phí ghi cent USD theo VNĐ thật đã trả. */
export const VND_MOI_USD = 26000;
/** ShopAIKey bán credit theo $ niêm yết, $1 credit = 3.250₫ tiền thật (memory feedback_chi_phi_vnd_that) — quy giá niêm yết ra tiền đã trả. */
export const VND_MOI_USD_SHOPAIKEY = 3250;
const vndRaCent = (vnd: number) => Math.round((vnd / VND_MOI_USD) * 100 * 1000) / 1000;

export type CongKey = 'ckey' | 'shopaikey' | 'google' | 'kie' | 'wavespeed' | 'plenxai';
/** Cổng có đường VIDEO qua guiVideoCong / docVideoCong (sinh-video.ts nhận clip theo provider này). */
export const CONG_VIDEO: readonly string[] = ['shopaikey', 'kie', 'wavespeed', 'plenxai'];
/** Thông tin nhà cung cấp — dùng cho tin báo hết tiền (tên, nơi nạp, vault giữ email/mật khẩu). */
export const CONG: Record<CongKey, { ten: string; napTien: string; vault: number | null; ghiChu: string }> = {
  ckey: { ten: 'CKEY.VN', napTien: 'https://ckey.vn/deposit', vault: 534, ghiChu: 'đăng nhập trên Chrome thường (Cloudflare chặn trình duyệt tự động); mã xác minh về Spam' },
  shopaikey: { ten: 'ShopAIKey', napTien: 'https://shopaikey.com/account', vault: 532, ghiChu: 'nạp xu rồi "Nạp thêm tiền" vào key hiện có' },
  google: { ten: 'Google AI Studio (Gemini API)', napTien: 'https://ai.studio/projects', vault: null, ghiChu: 'tín dụng trả trước của project gắn GOOGLE_API_KEY' },
  kie: { ten: 'Kie.ai', napTien: 'https://kie.ai/', vault: null, ghiChu: 'Veo 3.1 rẻ (lite 1080p 8s $0,175, đọc 16/10/2026); khoá KIE_API_KEY' },
  wavespeed: { ten: 'WaveSpeedAI', napTien: 'https://wavespeed.ai/pricing', vault: null, ghiChu: 'Kling 3.0 Std $0,084/s; khoá WAVESPEED_API_KEY' },
  plenxai: { ten: 'PlenX AI', napTien: 'https://plenxai.com/new/credits', vault: 560, ghiChu: 'Veo 3.1 Lite 600–800₫/clip (nạp VietQR 100₫ = 1 credit, credit nạp hạn 3 tháng); token đăng nhập Google mikerey887 ở /root/.secrets/plenxai.json (cong-plenxai.ts)' },
};

export type BuocNguon = { cong: CongKey | 'fal' | 'openai'; model: string; ok: boolean; loi?: string; het_tien?: boolean; giay?: number };
/** Nguồn của MỘT lượt sinh: cổng + model đã gọi + model thật phía sau + người bán + tiền thật + các bước đã thử. */
export type NguonSinh = { cong: CongKey | 'fal' | 'openai'; model: string; model_that?: string; nguoi_ban?: string; vnd?: number; cents?: number; giay?: number; thu: BuocNguon[] };

const KHOA_ENV: Record<CongKey, string[]> = { ckey: ['CKEY_API_KEY'], shopaikey: ['SHOPAIKEY_API_KEY'], google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'], kie: ['KIE_API_KEY'], wavespeed: ['WAVESPEED_API_KEY'], plenxai: [] };
// PlenX không có khoá env: cặp token nằm ở tệp trên box (cong-plenxai.ts › TOKEN_TEP, máy tự xoay) — luôn coi là có; thiếu tệp thì guiPlenx lỗi ngay, chuỗi sang cổng sau
const khoa = (k: CongKey) => (k === 'plenxai' ? 'tep' : KHOA_ENV[k].map((e) => process.env[e]).find(Boolean) || null);
export const coCong = (k: CongKey) => !!khoa(k);

/** Lỗi kiểu HẾT TIỀN của từng cổng (để báo nạp, không phải lỗi model). */
export function laHetTien(cong: string, loi: string, status?: number): boolean {
  if (status === 402) return true;
  if (cong === 'google') return /prepayment credits|credits are depleted|billing account|chưa gắn Cloud Billing/i.test(loi);
  return /insufficient|not enough|quota (is )?(not enough|exhausted|exceeded)|balance|số dư|hết tiền|额度|余额|payment required/i.test(loi);
}

/** Bảng giá cổng (VNĐ thật / ảnh) — đo + đối chiếu console 15/10/2026. */
const GIA_ANH_VND: Record<string, number> = {
  'ckey:wowztools/nano-banana-2': 110.5, 'ckey:wowztools/nano-banana-pro': 110.5, 'ckey:danielnguyenkarate/nano-banana-2': 480,
  'shopaikey:gemini-nano-banana-2.1': 683,
  'plenxai:nano-banana-2': 200, 'plenxai:nano-banana-pro': 500,
};

/** Chuỗi cổng cho một model ảnh Google (Nano Banana): rẻ + ổn định trước, Google trực tiếp cuối (sinhAnh lo). Chỉ cổng có khoá. */
export function chuoiAnh(modelGoogle: string): { cong: CongKey; model: string }[] {
  if (!/nano-banana|gemini.*image/i.test(modelGoogle)) return [];
  const ds: { cong: CongKey; model: string }[] = [
    { cong: 'ckey', model: 'wowztools/nano-banana-2' },        // → gemini-3.1-flash-image, 6/6 đạt 34–44s (15/10/2026)
    { cong: 'ckey', model: 'wowztools/nano-banana-pro' },      // → gemini-3.0-pro-image, cùng giá
    // Người bán THỨ HAI trên chợ ckey (danh mục 15/10/2026, 480₫ — vẫn rẻ hơn ShopAIKey 683₫ / Google 874₫): wowztools đổi tên / gỡ model thì
    // ảnh chưa phải rơi thẳng sang cổng đắt (30 giờ ngày 15/10 rơi hết sang Google).
    { cong: 'ckey', model: 'danielnguyenkarate/nano-banana-2' },
    { cong: 'plenxai', model: 'nano-banana-2' },              // 200₫ (2 credit, 21/10/2026) — sau ckey 110₫, trước ShopAIKey 683₫
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

/** ckey.vn là CHỢ: người bán tự đặt / đổi tên model. 15/10/2026 wowztools đổi `nano-banana-2` → `Nano-Banana-2` → mọi lượt báo 404 "model is not
 *  available" / 400 suốt 30 giờ (246 lượt hỏng, ảnh rơi hết sang Google 874₫ thay 110₫). Tra tên THẬT trong danh mục /v1/models (nhớ 1 giờ),
 *  khớp không phân biệt hoa thường; người bán gỡ hẳn → báo rõ, không gọi. Danh mục không đọc được → gọi bằng tên đã cấu hình như cũ. */
let khoCkey: { luc: number; ten: Map<string, string>; gia: Map<string, number> } | null = null;
async function napCkey(k: string): Promise<void> {
  if (khoCkey && Date.now() - khoCkey.luc < 3600_000) return;
  try {
    const r = await fetch('https://api.xah.io/v1/models', { headers: { authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(20_000) });
    const j = (await r.json()) as { data?: { id?: string; pricing?: { per_request?: number } }[] };
    if (r.ok && j.data?.length) {
      const ds = j.data.filter((m) => m.id);
      khoCkey = { luc: Date.now(), ten: new Map(ds.map((m) => [m.id!.toLowerCase(), m.id!])), gia: new Map(ds.filter((m) => typeof m.pricing?.per_request === 'number').map((m) => [m.id!, m.pricing!.per_request!])) };
    }
  } catch { /* giữ danh mục cũ / gọi bằng tên cấu hình */ }
}
export async function tenThatCkey(model: string, k: string): Promise<string | null> {
  await napCkey(k);
  if (!khoCkey) return model;
  return khoCkey.ten.get(model.toLowerCase()) ?? null;
}

/** Số ảnh tham chiếu tối đa từng cổng nhận. ckey (đo 15/10/2026, wowztools Nano-Banana-2): 3 ảnh đạt, 4–5 ảnh "upstream AI gateway rejected the
 *  request" trong 0,4s — keyframe phim #49 (7 ảnh) cả 9 shot rơi sang Google 874₫; trước đó follow-up #1379 "ckey 400 khi nhiều ảnh". */
export const TOI_DA_REF: Partial<Record<CongKey, number>> = { ckey: 3, plenxai: 8 };

/** NGƯỜI BÁN CKEY CÙNG MODEL dự phòng cho nhau (anh 15/10/2026: "ckey có nhiều nhà cung cấp, fallback trong số họ với nhau"). Thuần.
 *  Chỉ lấy ĐÚNG dòng Nano Banana (2 / gemini-3.1-flash-image trước, Pro sau) — model khác (Qwen, Seedream, gpt-image, bản Lite) ra hình khác
 *  hẳn, không phải dự phòng. Chỉ người bán rẻ hơn tranVnd (cổng kế: ShopAIKey 683₫ / Google 874₫). Người bán đang "nghỉ" (hỏng liên tiếp) bỏ qua. */
export const RE_NANO_CKEY = /^[^/]+\/(nano-banana-2|gemini-3\.1-flash-image|nano-banana-pro)$/i;
/** uuTien = người bán vừa chạy ĐẠT gần đây → đứng đầu (thử 15/10/2026: người rẻ nhất 65₫ và người 480₫ đều chết, chỉ wowztools sống — xếp thuần
 *  theo giá thì mỗi ảnh phải chờ người chết trước). */
export function chonNguoiBanCkey(danhMuc: { id: string; vnd: number }[], nghi: Set<string>, tranVnd = 683, uuTien: Set<string> = new Set()): { model: string; vnd: number }[] {
  const hang = (id: string) => (uuTien.has(id) ? 0 : 2) + (/pro$/i.test(id) ? 1 : 0);
  return danhMuc.filter((m) => RE_NANO_CKEY.test(m.id) && m.vnd < tranVnd && !nghi.has(m.id))
    .sort((a, b) => hang(a.id) - hang(b.id) || a.vnd - b.vnd).map((m) => ({ model: m.id, vnd: m.vnd }));
}
/** Cầu dao từng người bán (trong bộ nhớ tiến trình): hỏng HONG_LIEN lần liền → nghỉ NGHI_PHUT phút; một lần đạt là mở lại. Tránh mỗi ảnh
 *  phải chờ lại người bán đang chết (ngày 15/10 wowztools hỏng 246 lượt liền). */
const HONG_LIEN = 2, NGHI_PHUT = 20;
const hongCkey = new Map<string, { lan: number; luc: number }>();
const datCkey = new Map<string, number>();
const vuaDat = (): Set<string> => new Set([...datCkey].filter(([, luc]) => Date.now() - luc < 2 * 3600_000).map(([id]) => id));
const ghiCkey = (id: string, ok: boolean) => { if (ok) { hongCkey.delete(id); datCkey.set(id, Date.now()); return; } const h = hongCkey.get(id); hongCkey.set(id, { lan: (h?.lan ?? 0) + 1, luc: Date.now() }); };
const dangNghi = (): Set<string> => new Set([...hongCkey].filter(([, h]) => h.lan >= HONG_LIEN && Date.now() - h.luc < NGHI_PHUT * 60_000).map(([id]) => id));

/** ShopAIKey HẾT TIỀN TRÁ HÌNH (15/10/2026): khoá có trần (hard_limit $20) dùng tới $19,82 → mọi lượt trả "HTTP 403: Model not found or invalid",
 *  không phải câu hết tiền → laHetTien không bắt, không hiện báo nạp, 97 ảnh lặng lẽ rơi sang Google 874₫ thay 683₫ suốt 11 giờ. Cổng từ chối (4xx)
 *  thì đọc số dư của khoá (billing kiểu OpenAI: trần $ + đã dùng cent); còn dưới một lượt → đổi lỗi thành câu hết tiền rõ ràng. Thuần phần quyết định. */
export function loiHetTienShopaikey(tranUsd: number | undefined, daDungCent: number | undefined, toiThieuUsd = 0.5): string | null {
  if (tranUsd == null || daDungCent == null || !Number.isFinite(tranUsd) || !Number.isFinite(daDungCent)) return null;
  const con = tranUsd - daDungCent / 100;
  return con < toiThieuUsd ? `hết tiền: khoá ShopAIKey đã dùng $${(daDungCent / 100).toFixed(2)} / trần $${tranUsd} (còn $${Math.max(0, con).toFixed(2)}) — nạp thêm vào key` : null;
}
async function hetTienShopaikey(k: string, status: number): Promise<string | null> {
  if (status < 400 || status >= 500) return null;
  try {
    const h = { authorization: `Bearer ${k}` };
    const [a, b] = await Promise.all(['subscription', 'usage'].map((x) => fetch(`https://api.shopaikey.com/v1/dashboard/billing/${x}`, { headers: h, signal: AbortSignal.timeout(15_000) }).then((r) => r.json()).catch(() => ({}))));
    return loiHetTienShopaikey((a as { hard_limit_usd?: number }).hard_limit_usd, (b as { total_usage?: number }).total_usage);
  } catch { return null; }
}

/** Gọi MỘT cổng sinh ảnh. Ảnh tham chiếu đi bằng URL công khai (R2). Hết giờ chờ: ShopAIKey vẫn trừ tiền → chờ đủ lâu (240s). */
// ── PlenX AI · ẢNH (đọc mã trang 21/10/2026, TextToImage): POST /api/v1/queue/submit {task_type:'image/<model>', payload:{prompt, aspect_ratio,
// resolution_tier:'1k', uses_credits, references_urls}} → GET /api/v1/queue/status/<task_id> (result.result_url | image_urls[0]) → tải về →
// DELETE /api/v1/generations/<generation_id> (anh: sinh xong tải về thì xoá trên nền tảng của họ). Chỉ fetch — chạy được cả trong Worker:
// token lấy từ máy chủ (CONG_MAY.plenxai.token, có tệp) hoặc hỏi studio /api/xv/plenx-token (Worker, khoá XV_WORKER_SECRET).
async function tokenPlenx(): Promise<string> {
  if (CONG_MAY.plenxai?.token) return CONG_MAY.plenxai.token();
  const goc = process.env.STUDIO_URL, bi = process.env.XV_WORKER_SECRET;
  if (!goc || !bi) throw new Error('không có đường lấy token PlenX (máy chủ chưa đăng ký, Worker thiếu STUDIO_URL / XV_WORKER_SECRET)');
  const r = await fetch(`${goc}/api/xv/plenx-token`, { headers: { 'x-xv-secret': bi }, signal: AbortSignal.timeout(30_000) });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; loi?: string };
  if (!r.ok || !j.access_token) throw new Error(`studio không cấp token PlenX (${r.status}${j.loi ? `: ${j.loi}` : ''})`);
  return j.access_token;
}
async function anhPlenx(model: string, o: { prompt: string; thamChieuUrl: string[]; tiLe: TiLeAnh }): Promise<KqAnhCong> {
  try {
    const h = { authorization: `Bearer ${await tokenPlenx()}`, 'content-type': 'application/json' };
    const r = await fetch('https://plenxai.com/api/v1/queue/submit', { method: 'POST', headers: h, signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ task_type: `image/${model}`, payload: { prompt: o.prompt, aspect_ratio: o.tiLe, num_outputs: 1, output_format: 'jpeg', resolution_tier: '1k', uses_credits: true, references_urls: o.thamChieuUrl.slice(0, 8) } }) });
    const j = (await r.json().catch(() => ({}))) as { success?: boolean; task_id?: string; message?: string; error?: string };
    if (!r.ok || !j.success || !j.task_id) return { ok: false, status: r.status, loi: `PlenX ${r.status}: ${j.message || j.error || 'không nhận task'}`.slice(0, 300) };
    for (let i = 0; i < 80; i++) {   // ≤ 4 phút
      await new Promise((ok) => setTimeout(ok, 3000));
      const s = await fetch(`https://plenxai.com/api/v1/queue/status/${encodeURIComponent(j.task_id)}`, { headers: h, signal: AbortSignal.timeout(30_000) }).catch(() => null);
      if (!s?.ok) continue;
      const d = (await s.json().catch(() => ({}))) as { status?: string; result_url?: string; generation_id?: string; error?: string; error_message?: string; result?: { result_url?: string; image_urls?: string[]; images?: string[]; generation_id?: string } };
      const url = d.result?.result_url || d.result?.image_urls?.[0] || d.result?.images?.[0] || d.result_url;
      if (d.status === 'completed' && url) {
        const anh = await taiVe(url);
        const gid = d.generation_id || d.result?.generation_id;
        if (anh && gid) await fetch(`https://plenxai.com/api/v1/generations/${encodeURIComponent(gid)}`, { method: 'DELETE', headers: h, signal: AbortSignal.timeout(30_000) }).catch(() => null);
        return anh ? { ok: true, ...anh, modelThat: `plenxai/${model}` } : { ok: false, loi: 'PlenX xong nhưng không tải được ảnh' };
      }
      if (['failed', 'error', 'cancelled', 'nsfw'].includes(String(d.status))) return { ok: false, loi: `PlenX báo ${d.status}: ${d.error || d.error_message || ''}`.slice(0, 300) };
    }
    return { ok: false, loi: 'PlenX quá 4 phút chưa xong' };
  } catch (e) { return { ok: false, loi: `PlenX: ${e instanceof Error ? e.message.slice(0, 200) : 'lỗi mạng'}` }; }
}

export async function sinhAnhCong(cong: CongKey, model: string, o: { prompt: string; thamChieuUrl: string[]; tiLe: TiLeAnh }): Promise<KqAnhCong> {
  const k = khoa(cong);
  if (!k) return { ok: false, loi: `thiếu khoá ${cong}` };
  if (cong === 'plenxai') return anhPlenx(model, o);
  if (cong === 'ckey') {
    const that = await tenThatCkey(model, k);
    if (!that) return { ok: false, loi: `ckey: người bán đã gỡ model ${model} khỏi chợ (không có trong danh mục) — chọn người bán khác` };
    model = that;
  }
  const ref = o.thamChieuUrl.slice(0, 5);
  const [url, body, cho] = cong === 'ckey'
    ? ['https://api.xah.io/v1/images/generations', { model, prompt: o.prompt, size: o.tiLe, aspect_ratio: o.tiLe, n: 1, image_urls: ref, image: ref }, 180_000]
    : ['https://api.shopaikey.com/images/google/generations', { model, prompt: o.prompt, size: o.tiLe, imageSize: '1K', response_format: 'url', image_urls: ref }, 240_000];
  let r: Response;
  try {
    r = await fetch(url as string, { method: 'POST', headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(cho as number) });
  } catch (e) { return { ok: false, loi: `không nhận được trả lời (${e instanceof Error ? e.name : 'lỗi mạng'})` }; }
  const j = (await r.json().catch(() => ({}))) as { data?: { url?: string; b64_json?: string }[]; model?: string; error?: { message?: string } | string; message?: string };
  if (!r.ok) {
    const het = cong === 'shopaikey' ? await hetTienShopaikey(k, r.status) : null;
    return { ok: false, status: het ? 402 : r.status, loi: het ?? `HTTP ${r.status}: ${(typeof j.error === 'string' ? j.error : j.error?.message) || j.message || 'lỗi'}`.slice(0, 300) };
  }
  const d = j.data?.[0];
  if (d?.b64_json) return { ok: true, data: Buffer.from(d.b64_json, 'base64'), mimeType: 'image/png', modelThat: j.model };
  if (d?.url) { const t = await taiVe(d.url); return t ? { ok: true, ...t, modelThat: j.model } : { ok: false, loi: 'không tải được ảnh cổng trả về' }; }
  return { ok: false, loi: 'cổng không trả ảnh' };
}

/** Thử lần lượt chuỗi cổng; trả ảnh + nguồn, hoặc null + các bước đã hỏng (sinhAnh nối tiếp sang Google). */
export async function sinhAnhQuaCong(modelGoogle: string, o: { prompt: string; thamChieuUrl: string[]; tiLe: TiLeAnh }): Promise<{ anh: { data: Buffer; mimeType: string } | null; nguon: NguonSinh | null; thu: BuocNguon[] }> {
  const thu: BuocNguon[] = [];
  const tinh = chuoiAnh(modelGoogle);
  // Ckey: thay các dòng cấu hình tĩnh bằng MỌI người bán Nano Banana đang có trong danh mục (rẻ → đắt, bỏ người đang nghỉ); không đọc được
  // danh mục thì giữ chuỗi tĩnh. Giá ghi sổ lấy đúng giá danh mục của người bán đã chạy.
  const giaDong: Record<string, number> = {};
  let chuoi = tinh;
  const kc = khoa('ckey');
  if (kc && tinh.some((x) => x.cong === 'ckey')) {
    await napCkey(kc);
    if (khoCkey) {
      const ban = chonNguoiBanCkey([...khoCkey.gia].map(([id, vnd]) => ({ id, vnd })), dangNghi(), undefined, vuaDat());
      for (const b of ban) giaDong[`ckey:${b.model}`] = b.vnd;
      chuoi = [...ban.map((b) => ({ cong: 'ckey' as const, model: b.model })), ...tinh.filter((x) => x.cong !== 'ckey')];
    }
  }
  for (const b of chuoi) {
    // Cổng nhận ít ảnh tham chiếu hơn shot cần → BỎ QUA, không cắt bớt: prompt có bản đồ "ảnh N là gì" (xepThamChieu), cắt ảnh là bản đồ sai, ảnh ra sai.
    const toiDa = TOI_DA_REF[b.cong];
    if (toiDa != null && o.thamChieuUrl.length > toiDa) { thu.push({ cong: b.cong, model: b.model, ok: false, loi: `cổng nhận tối đa ${toiDa} ảnh tham chiếu, shot có ${o.thamChieuUrl.length} — bỏ qua`, giay: 0 }); continue; }
    const t0 = Date.now();
    let kq = await sinhAnhCong(b.cong, b.model, o);
    // Người bán trả model KHÁC (ảnh ra không phải Nano Banana) → coi như hỏng, sang người kế.
    if (kq.ok && b.cong === 'ckey' && kq.modelThat && !/flash-image|pro-image|banana|gemini/i.test(kq.modelThat)) kq = { ok: false, loi: `người bán trả model khác (${kq.modelThat})` };
    if (b.cong === 'ckey') ghiCkey(b.model, kq.ok);
    const giay = Math.round((Date.now() - t0) / 100) / 10;
    if (kq.ok) {
      const vnd = giaDong[`${b.cong}:${b.model}`] ?? GIA_ANH_VND[`${b.cong}:${b.model}`];
      thu.push({ cong: b.cong, model: b.model, ok: true, giay });
      return { anh: kq, thu, nguon: { cong: b.cong, model: b.model, model_that: kq.modelThat, nguoi_ban: b.cong === 'ckey' ? b.model.split('/')[0] : undefined, vnd, cents: vnd != null ? vndRaCent(vnd) : undefined, giay, thu } };
    }
    thu.push({ cong: b.cong, model: b.model, ok: false, loi: kq.loi, het_tien: laHetTien(b.cong, kq.loi, kq.status), giay });
  }
  return { anh: null, nguon: null, thu };
}

const TEN_CONG: Record<string, string> = { plenxai: 'PlenX AI', ckey: 'ckey.vn', shopaikey: 'ShopAIKey', google: 'Google', fal: 'fal', openai: 'OpenAI', kie: 'Kie.ai', wavespeed: 'WaveSpeedAI' };
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
// Kie / WaveSpeed: giá đọc trang giá 16/10/2026 (sổ nguồn AI, migration 0265) — Kie ghi giá clip 8s 1080p, studio gọi 720p nên đây là mức trần.
const GIA_VIDEO_VND: Record<string, number> = { 'plenxai:veo3-lite': 800, 'plenxai:veo3-fast': 1400, 'plenxai:wan-3.0': 1800, 'shopaikey:grok-video-3-10s': 3250, 'shopaikey:grok-imagine-video-1.5': 6500, 'kie:veo3_lite': 4550, 'kie:veo3_fast': 8450, 'wavespeed:kwaivgi/kling-v3.0-std/image-to-video': 17472 };
export const giaVideoCong = (cong: string, model: string): { vnd?: number; cents?: number } => {
  const vnd = GIA_VIDEO_VND[`${cong}:${model}`];
  return vnd != null ? { vnd, cents: vndRaCent(vnd) } : {};
};

/** Chuỗi cổng video cho một shot dùng Veo (Google): Grok qua ShopAIKey trước. Chỉ khi có khoá. */
/** laQc: bỏ bậc không hợp quảng cáo (kieu.ts › MO_HINH_KHONG_QC) — chuỗi rỗng thì shot đi thẳng Google. */
/** Kie.ai đứng ĐẦU chuỗi Veo (cùng model Veo 3.1, rẻ hơn fal ~27% và Google ~56% — sổ nguồn 16/10/2026). Không có khoá thì bỏ qua bậc đó. */
export function chuoiVideo(modelGoc: string, laQc: boolean): { cong: CongKey; model: string; giay: number }[] {
  if (!/^veo/i.test(modelGoc)) return [];
  const kie = /lite/i.test(modelGoc) ? 'veo3_lite' : /fast/i.test(modelGoc) ? 'veo3_fast' : null;
  const plenx = /lite/i.test(modelGoc) ? 'veo3-lite' : /fast/i.test(modelGoc) ? 'veo3-fast' : null;
  const ds: { cong: CongKey; model: string; giay: number }[] = [
    // PlenX ĐẦU chuỗi (21/10/2026): cùng Veo 3.1, 600–800₫ / clip (Kie 4.550₫); token hỏng / hết credit → Kie
    ...(plenx ? [{ cong: 'plenxai' as const, model: plenx, giay: 8 }] : []),
    ...(kie ? [{ cong: 'kie' as const, model: kie, giay: 8 }] : []),
    { cong: 'shopaikey', model: 'grok-video-3-10s', giay: 10 }, { cong: 'shopaikey', model: 'grok-imagine-video-1.5', giay: 6 },
  ];
  return ds.filter((b) => coCong(b.cong) && hopQc(`${b.cong}:${b.model}`, laQc));
}

/** Cổng CHỈ CHẠY TRÊN MÁY CHỦ (cần node:fs — PlenX giữ token ở tệp): tệp đó tự đăng ký vào đây khi được import ở phía máy chủ (sinh-video.ts),
 *  để cong-ai.ts (giao diện + Worker cũng import) không kéo node:fs vào bản build trình duyệt. */
type CongMay = { gui: (model: string, o: { prompt: string; anhDau: string; anhCuoi?: string | null; giay: number; doPhanGiai?: '720p' | '1080p' }) => Promise<KqGui>; doc: (taskId: string, taoLuc: string, treoPhut: number) => Promise<KqDoc>; /** xoá clip trên nền tảng của họ SAU khi đã lưu về R2 (anh 21/10/2026) */ xoa?: (uri: string) => Promise<void>; /** token còn hạn (PlenX) */ token?: () => Promise<string> };
export const CONG_MAY: Partial<Record<CongKey, CongMay>> = {};
/** Clip đã lưu về kho của mình (R2) → xoá bản trên nền tảng cổng nếu cổng có lệnh xoá (PlenX). Không chặn: lỗi chỉ ghi log. */
export async function donVideoCong(cong: string | null | undefined, uri: string): Promise<void> {
  const x = cong ? CONG_MAY[cong as CongKey]?.xoa : undefined; if (!x) return;
  try { await x(uri); } catch (e) { console.error(`[${cong}] không xoá được clip trên nền tảng:`, e instanceof Error ? e.message : e); }
}
/** Gửi một task video lên cổng: khung đầu = keyframe (URL công khai). Trả task id hoặc lỗi (lỗi gửi = không tính tiền). */
export async function guiVideoCong(cong: CongKey, model: string, o: { prompt: string; anhDau: string; /** ảnh CUỐI (keyframe KẾT) — cổng nhận hai ảnh (kie Veo FIRST_AND_LAST_FRAMES) thì gửi */ anhCuoi?: string | null; giay: number ; /** độ phân giải của phim (kinh_thanh.do_phan_giai) — Kie Veo nhận 1080p; cổng khác giữ 720p */ doPhanGiai?: '720p' | '1080p' }): Promise<{ ok: true; taskId: string } | { ok: false; loi: string; status?: number }> {
  const k = khoa(cong);
  if (!k || !CONG_VIDEO.includes(cong)) return { ok: false, loi: `cổng ${cong} chưa có đường video` };
  if (cong === 'kie') return guiKie(k, model, o);
  if (cong === 'plenxai') return CONG_MAY.plenxai ? CONG_MAY.plenxai.gui(model, o) : { ok: false, loi: 'cổng PlenX chỉ chạy trên máy chủ (cong-plenxai.ts chưa đăng ký)' };
  if (cong === 'wavespeed') return guiWavespeed(k, model, o);
  try {
    const r = await fetch('https://api.shopaikey.com/v1/video/generations', {
      method: 'POST', headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ model, prompt: o.prompt, metadata: { images: [o.anhDau], aspect_ratio: '2:3', duration: o.giay, resolution: '720p' } }),
    });
    const j = (await r.json().catch(() => ({}))) as { task_id?: string; id?: string; error?: { message?: string }; message?: string };
    const id = j.task_id || j.id;
    if (!r.ok || !id) {
      const het = await hetTienShopaikey(k, r.status);
      return { ok: false, status: het ? 402 : r.status, loi: het ?? `HTTP ${r.status}: ${j.error?.message || j.message || 'không nhận task'}`.slice(0, 300) };
    }
    return { ok: true, taskId: id };
  } catch (e) { return { ok: false, loi: `không gửi được (${e instanceof Error ? e.name : 'lỗi mạng'})` }; }
}

/** Hỏi trạng thái task cổng. treo = chưa chạy sau TREO_PHUT phút kể từ lúc gửi (tinh từ `taoLuc`). */
export async function docVideoCong(cong: string, taskId: string, taoLuc: string): Promise<{ done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string; treo?: boolean }> {
  const k = khoa(cong as CongKey);
  if (!k) return { done: true, ok: false, loi: `thiếu khoá ${cong}` };
  if (cong === 'kie') return docKie(k, taskId, taoLuc);
  if (cong === 'plenxai') return CONG_MAY.plenxai ? CONG_MAY.plenxai.doc(taskId, taoLuc, TREO_PHUT) : { done: true, ok: false, loi: 'cổng PlenX chưa đăng ký trên máy chủ' };
  if (cong === 'wavespeed') return docWavespeed(k, taskId, taoLuc);
  const r = await fetch(`https://api.shopaikey.com/v1/video/generations/${encodeURIComponent(taskId)}`, { headers: { authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!r?.ok) return { done: false };
  const d = ((await r.json().catch(() => ({}))) as { data?: { status?: string; result_url?: string; fail_reason?: string; start_time?: number } }).data ?? {};
  const st = String(d.status ?? '').toUpperCase();
  if (st === 'SUCCESS' && d.result_url) return { done: true, ok: true, uri: d.result_url };
  if (st === 'FAILURE' || st === 'FAILED') return { done: true, ok: false, loi: `cổng báo hỏng: ${d.fail_reason || 'không rõ'}` };
  if (!d.start_time && Date.now() - new Date(taoLuc).getTime() > TREO_PHUT * 60_000) return { done: true, ok: false, treo: true, loi: `treo hàng đợi ${TREO_PHUT} phút chưa chạy` };
  return { done: false };
}

// ── Kie.ai (docs.kie.ai: POST /api/v1/jobs/createTask · GET /api/v1/jobs/recordInfo?taskId=; lỗi trả HTTP 200 + code ≠ 200) ──
type KqGui = { ok: true; taskId: string } | { ok: false; loi: string; status?: number };
type KqDoc = { done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string; treo?: boolean };
const quaHan = (taoLuc: string) => Date.now() - new Date(taoLuc).getTime() > TREO_PHUT * 60_000;
async function guiKie(k: string, model: string, o: { prompt: string; anhDau: string; anhCuoi?: string | null; giay: number; doPhanGiai?: '720p' | '1080p' }): Promise<KqGui> {
  try {
    const r = await fetch('https://api.kie.ai/api/v1/jobs/createTask', { method: 'POST', headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ model: 'veo-3-1', input: { prompt: o.prompt, model, image_urls: o.anhCuoi ? [o.anhDau, o.anhCuoi] : [o.anhDau], generation_type: 'FIRST_AND_LAST_FRAMES_2_VIDEO'   /* 19/10/2026: trước chỉ gửi ảnh đầu — keyframe KẾT có mà không bao giờ tới Veo, #1 đoán kết cục */, aspect_ratio: '9:16', resolution: o.doPhanGiai === '1080p' ? '1080p' : '720p'   /* 19/10/2026: creative QC luôn HD — phim khai 1080p thì clip 1080p (trước gắn cứng 720p) */, duration: o.giay <= 4 ? 4 : o.giay <= 6 ? 6 : 8 } }) });
    const j = (await r.json().catch(() => ({}))) as { code?: number; msg?: string; data?: { taskId?: string } };
    if (j.code !== 200 || !j.data?.taskId) return { ok: false, status: j.code === 402 ? 402 : r.status, loi: `Kie.ai ${j.code ?? r.status}: ${j.msg || 'không nhận task'}`.slice(0, 300) };
    return { ok: true, taskId: j.data.taskId };
  } catch (e) { return { ok: false, loi: `không gửi được Kie.ai (${e instanceof Error ? e.name : 'lỗi mạng'})` }; }
}
async function docKie(k: string, taskId: string, taoLuc: string): Promise<KqDoc> {
  const r = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: { authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!r?.ok) return { done: false };
  const d = ((await r.json().catch(() => ({}))) as { data?: { state?: string; resultJson?: string; failMsg?: string } }).data ?? {};
  if (d.state === 'success') {
    // 720p: resultJson.resultUrls · 1080p (19/10/2026): resultJson.data.result_urls (bản upsample) + high_resolution_pending — đọc cả hai, đang upsample thì chờ
    let url: string | undefined; let cho = false;
    try { const j = JSON.parse(d.resultJson ?? '{}') as { resultUrls?: string[]; data?: { result_urls?: string[]; high_resolution_pending?: boolean } }; cho = j.data?.high_resolution_pending === true; url = j.resultUrls?.[0] ?? j.data?.result_urls?.[0]; } catch { url = undefined; }
    if (cho && !quaHan(taoLuc)) return { done: false };
    return url ? { done: true, ok: true, uri: url } : { done: true, ok: false, loi: 'Kie.ai báo xong nhưng không có link video' };
  }
  if (d.state === 'fail') return { done: true, ok: false, loi: `Kie.ai báo hỏng: ${d.failMsg || 'không rõ'}` };
  if ((d.state === 'waiting' || d.state === 'queuing') && quaHan(taoLuc)) return { done: true, ok: false, treo: true, loi: `Kie.ai treo hàng đợi ${TREO_PHUT} phút` };
  return { done: false };
}
// ── WaveSpeedAI (wavespeed.ai/docs: POST /api/v3/{model} · GET /api/v3/predictions/{id}/result) ──
async function guiWavespeed(k: string, model: string, o: { prompt: string; anhDau: string; giay: number }): Promise<KqGui> {
  try {
    const r = await fetch(`https://api.wavespeed.ai/api/v3/${model}`, { method: 'POST', headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ image: o.anhDau, prompt: o.prompt, duration: o.giay <= 5 ? 5 : 10 }) });
    const j = (await r.json().catch(() => ({}))) as { code?: number; message?: string; data?: { id?: string } };
    if (!r.ok || !j.data?.id) return { ok: false, status: r.status, loi: `WaveSpeedAI ${r.status}: ${j.message || 'không nhận task'}`.slice(0, 300) };
    return { ok: true, taskId: j.data.id };
  } catch (e) { return { ok: false, loi: `không gửi được WaveSpeedAI (${e instanceof Error ? e.name : 'lỗi mạng'})` }; }
}
async function docWavespeed(k: string, taskId: string, taoLuc: string): Promise<KqDoc> {
  const r = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(taskId)}/result`, { headers: { authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!r?.ok) return { done: false };
  const d = ((await r.json().catch(() => ({}))) as { data?: { status?: string; outputs?: unknown[]; error?: unknown } }).data ?? {};
  if (d.status === 'completed') { const url = (d.outputs ?? []).find((x): x is string => typeof x === 'string'); return url ? { done: true, ok: true, uri: url } : { done: true, ok: false, loi: 'WaveSpeedAI báo xong nhưng không có link video' }; }
  if (['failed', 'cancelled', 'timeout', 'deleted'].includes(String(d.status))) return { done: true, ok: false, loi: `WaveSpeedAI báo ${d.status}: ${String(d.error ?? '').slice(0, 200)}` };
  if (d.status === 'created' && quaHan(taoLuc)) return { done: true, ok: false, treo: true, loi: `WaveSpeedAI treo ${TREO_PHUT} phút` };
  return { done: false };
}

// ── CHỌN ĐÍCH DANH NGUỒN (15/10/2026 — anh: "cùng 1 shot có thể tạo từ nhiều model, nhà cung cấp khác nhau") ─────────────────
// Khoá model trên ô chọn: '<cổng>:<model>' = gọi đúng cổng đó (không dự phòng); 'google:<model>' = Google trực tiếp, bỏ qua chuỗi cổng;
// model Google trần (vd gemini-nano-banana-2.1, veo-…) = TỰ CHỌN rẻ nhất theo chuỗi (chuoiAnh / chuoiVideo).
export type MoHinhCong = { key: string; label: string; nhom: string; vnd: number; donVi: 'anh' | 'clip'; giay?: number };
/** Model video HIỂU ẢNH THỨ 2 "kết + dải nhịp" (sinh-video.ts › anhCuoiChuoi) là chỉ dẫn, không vẽ dải vào phim — chỉ Veo (đo 19/10/2026 tập 122). Model khác
 *  nhận ảnh KẾT trơn: Wan 3.0 (PlenX DURIAN, 23/10/2026 phim #132 #19) vẽ nguyên dải nhịp vào nửa sau clip. */
export const hieuDaiNhip = (model: string): boolean => /veo/i.test(model);
export const MO_HINH_CONG: MoHinhCong[] = [
  { key: 'ckey:wowztools/nano-banana-2', label: 'Nano Banana 2 (Gemini 3.1 Flash Image)', nhom: 'ckey.vn', vnd: 110.5, donVi: 'anh' },
  { key: 'ckey:wowztools/nano-banana-pro', label: 'Nano Banana Pro (Gemini 3 Pro Image)', nhom: 'ckey.vn', vnd: 110.5, donVi: 'anh' },
  { key: 'plenxai:nano-banana-2', label: 'Nano Banana 2 · PlenX AI', nhom: 'PlenX AI', vnd: 200, donVi: 'anh' },
  { key: 'plenxai:nano-banana-pro', label: 'Nano Banana Pro (Full) · PlenX AI', nhom: 'PlenX AI', vnd: 500, donVi: 'anh' },
  { key: 'shopaikey:gemini-nano-banana-2.1', label: 'Nano Banana 2.1', nhom: 'ShopAIKey', vnd: 683, donVi: 'anh' },
  { key: 'shopaikey:grok-video-3-10s', label: 'Grok Video 3 · 10s (khung 2:3, xuất tự cắt 9:16)', nhom: 'ShopAIKey', vnd: 3250, donVi: 'clip', giay: 10 },
  { key: 'shopaikey:grok-imagine-video-1.5', label: 'Grok Imagine Video 1.5 · 6s (khung 2:3)', nhom: 'ShopAIKey', vnd: 6500, donVi: 'clip', giay: 6 },
  { key: 'plenxai:veo3-lite', label: 'Veo 3.1 Lite · PlenX AI (clip 4–8s, 9:16)', nhom: 'PlenX AI', vnd: 800, donVi: 'clip', giay: 8 },
  { key: 'plenxai:veo3-fast', label: 'Veo 3.1 Fast · PlenX AI (clip 4–8s, 9:16)', nhom: 'PlenX AI', vnd: 1400, donVi: 'clip', giay: 8 },
  { key: 'plenxai:wan-3.0', label: 'Wan 3.0 · PlenX AI DURIAN (clip 5 / 10s, khung đầu + cuối, gói Free được)', nhom: 'PlenX AI', vnd: 1800, donVi: 'clip', giay: 10 },
  { key: 'kie:veo3_lite', label: 'Veo 3.1 Lite · Kie.ai (clip 4–8s, 9:16)', nhom: 'Kie.ai', vnd: 4550, donVi: 'clip', giay: 8 },
  { key: 'kie:veo3_fast', label: 'Veo 3.1 Fast · Kie.ai (clip 4–8s, 9:16)', nhom: 'Kie.ai', vnd: 8450, donVi: 'clip', giay: 8 },
  { key: 'wavespeed:kwaivgi/kling-v3.0-std/image-to-video', label: 'Kling 3.0 Std · WaveSpeedAI (5 / 10s)', nhom: 'WaveSpeedAI', vnd: 17472, donVi: 'clip', giay: 8 },
];
export const centsCong = (vnd: number) => vndRaCent(vnd);
/** Tách khoá model: cổng đích danh / Google trực tiếp / tự chọn. */
export function tachKhoa(key: string): { kieu: 'cong'; cong: CongKey; model: string } | { kieu: 'google'; model: string } | { kieu: 'tu_chon'; model: string } {
  const m = /^(ckey|shopaikey|google|kie|wavespeed|plenxai):(.+)$/.exec(key);
  if (!m) return { kieu: 'tu_chon', model: key };
  return m[1] === 'google' ? { kieu: 'google', model: m[2]! } : { kieu: 'cong', cong: m[1] as CongKey, model: m[2]! };
}
/** Giá THẬT (cent) của một ảnh qua cổng đích danh 'cổng:model' (vd ckey:wowztools/nano-banana-2) — null nếu không phải cổng có bảng giá. */
export const giaAnhCong = (k: string): number | null => (GIA_ANH_VND[k] != null ? vndRaCent(GIA_ANH_VND[k]!) : null);
/** Một cổng đích danh cho ảnh: gọi đúng một lần, kèm nguồn. */
export async function sinhAnhMotCong(cong: CongKey, model: string, o: { prompt: string; thamChieuUrl: string[]; tiLe: TiLeAnh }): Promise<{ anh: { data: Buffer; mimeType: string } | null; nguon: NguonSinh; loi?: string }> {
  // Cổng nhận ít ảnh tham chiếu hơn shot cần → dừng NGAY, không gửi lượt chắc chắn bị từ chối (17/10/2026 tập 122 #13: ckey 400 hai lần với 5 ảnh);
  // không cắt bớt ảnh (bản đồ "ảnh N là gì" trong prompt sẽ sai) — chọn cổng nhận đủ ảnh. CÙNG luật chuỗi cổng (sinhAnhQuaCong).
  const toiDa = TOI_DA_REF[cong];
  if (toiDa != null && o.thamChieuUrl.length > toiDa) { const loi = `cổng ${cong} nhận tối đa ${toiDa} ảnh tham chiếu, shot có ${o.thamChieuUrl.length} — chọn cổng khác (vd shopaikey:)`; return { anh: null, loi, nguon: { cong, model, thu: [{ cong, model, ok: false, loi, giay: 0 }] } }; }
  const t0 = Date.now();
  const kq = await sinhAnhCong(cong, model, o);
  const giay = Math.round((Date.now() - t0) / 100) / 10;
  const vnd = GIA_ANH_VND[`${cong}:${model}`];
  if (kq.ok) return { anh: kq, nguon: { cong, model, model_that: kq.modelThat, nguoi_ban: cong === 'ckey' ? model.split('/')[0] : undefined, vnd, cents: vnd != null ? vndRaCent(vnd) : undefined, giay, thu: [{ cong, model, ok: true, giay }] } };
  return { anh: null, loi: kq.loi, nguon: { cong, model, thu: [{ cong, model, ok: false, loi: kq.loi, het_tien: laHetTien(cong, kq.loi, kq.status), giay }] } };
}
/** Nhãn NGẮN dưới ảnh/clip: "ckey · nano-banana-2" (model bỏ tiền tố người bán). Đủ chi tiết ở taNguon (rê chuột). */
export function taNguonNgan(n: NguonSinh | null | undefined, providerCu?: string, modelCu?: string): string {
  const cong = n?.cong ?? providerCu ?? '';
  const model = (n?.model ?? modelCu ?? '').replace(/^(ckey|shopaikey|google|fal):/, '').replace(/^[^/]+\//, '');
  return [TEN_CONG[cong] ?? cong, model].filter(Boolean).join(' · ');
}
