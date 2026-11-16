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

// Khoá nhà cung cấp KHÔNG còn ở studio (anh 16/11/2026: một cổng cho mọi model): cổng AI chung giữ khoá + token PlenX. coCong = cổng chung có tuyến cho
// cổng đó (spy-on-tc/server/cong-anh.mjs · cong-media.mjs). WaveSpeed chưa có tuyến ở cổng → tắt (model WaveSpeed trên ô chọn ẩn).
const CO_TUYEN: ReadonlySet<CongKey> = new Set(['ckey', 'shopaikey', 'google', 'kie', 'plenxai']);
export const coCong = (k: CongKey) => CO_TUYEN.has(k);

/** Lỗi kiểu HẾT TIỀN của từng cổng (để báo nạp, không phải lỗi model). */
export function laHetTien(cong: string, loi: string, status?: number): boolean {
  if (status === 402) return true;
  if (cong === 'google') return /prepayment credits|credits are depleted|billing account|chưa gắn Cloud Billing/i.test(loi);
  return /insufficient|not enough|quota (is )?(not enough|exhausted|exceeded)|balance|số dư|hết tiền|额度|余额|payment required/i.test(loi);
}

/** Bảng giá cổng (VNĐ thật / ảnh) — đo + đối chiếu console 15/10/2026. */
export const GIA_ANH_VND: Record<string, number> = {
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

/** Số ảnh tham chiếu tối đa từng cổng nhận. ckey (đo 15/10/2026, wowztools Nano-Banana-2): 3 ảnh đạt, 4–5 ảnh "upstream AI gateway rejected the
 *  request" trong 0,4s — keyframe phim #49 (7 ảnh) cả 9 shot rơi sang Google 874₫; trước đó follow-up #1379 "ckey 400 khi nhiều ảnh". */
export const TOI_DA_REF: Partial<Record<CongKey, number>> = { ckey: 3, plenxai: 8 };

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

/** Khung hình gửi cổng video: khung của PHIM (kinh_thanh.ti_le) — 01/11/2026 phim 16:9 ra clip dọc 720×1280 vì PlenX / Kie gắn cứng 9:16, ShopAIKey 2:3.
 *  Cổng chỉ nhận dọc / ngang; khung lạ → 9:16 (QC dọc, mặc định cũ). */
export const khungVideoCong = (tiLe?: string | null): '16:9' | '9:16' => (tiLe === '16:9' ? '16:9' : '9:16');


// ── CHỌN ĐÍCH DANH NGUỒN (15/10/2026 — anh: "cùng 1 shot có thể tạo từ nhiều model, nhà cung cấp khác nhau") ─────────────────
// Khoá model trên ô chọn: '<cổng>:<model>' = gọi đúng cổng đó (không dự phòng); 'google:<model>' = Google chính hãng (qua cổng, ép đúng cổng đó), bỏ qua chuỗi;
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
/** Nhãn NGẮN dưới ảnh/clip: "ckey · nano-banana-2" (model bỏ tiền tố người bán). Đủ chi tiết ở taNguon (rê chuột). */
export function taNguonNgan(n: NguonSinh | null | undefined, providerCu?: string, modelCu?: string): string {
  const cong = n?.cong ?? providerCu ?? '';
  const model = (n?.model ?? modelCu ?? '').replace(/^(ckey|shopaikey|google|fal):/, '').replace(/^[^/]+\//, '');
  return [TEN_CONG[cong] ?? cong, model].filter(Boolean).join(' · ');
}
