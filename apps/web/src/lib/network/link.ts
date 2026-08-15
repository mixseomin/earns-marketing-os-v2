// Dựng link theo dõi của network mình + đọc ngược mã click.
//
// Thuần, không phụ thuộc DB/env → chạy được bằng `node scripts/check-network-platform.ts`.

/** Ô sub-id mà mỗi network upstream trả lại cho mình. Mã click nhét vào ĐÂY, không nhét chỗ khác.
 *  Số liệu lấy từ NETWORK_PAYOUTS trong affiliate-networks.ts (đã web-verify từng cái).
 *  Network chưa rõ tham số thì KHÔNG đoán bừa — `null`, và offer thuộc nó bị chặn ở validate. */
export const SUB_PARAM: Record<string, string | null> = {
  cj: 'sid',                 // 1 ô, ≤64 ký tự ASCII
  awin: 'clickref',          // 6 ô, dùng ô đầu là đủ
  impact: 'subId1',          // 4 ô, 255 ký tự mỗi ô
  rakuten: 'subid',
  accesstrade: 'sub1',
  clickbank: 'tid',          // ≤24 ký tự → mã click phải ngắn, xem CLICK_ID_LEN
  vcommission: 'aff_sub',
  travelpayouts: null,       // marker=<ID>.<subID> — nối vào giá trị sẵn có, không phải tham số riêng
  tkglobal: null,
  adpia: null,
  masoffer: null,
  ecomobi: null,
};

/** 12 ký tự base36 ≈ 62 bit. Vừa ô hẹp nhất đang dùng (ClickBank `tid` ≤24) và thừa sức tránh
 *  trùng ở mọi sản lượng mình sẽ chạm tới. Dài hơn không mua thêm gì mà lại vượt ô của ClickBank. */
export const CLICK_ID_LEN = 12;

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Sinh mã click. `rand` tách ra để test bơm số cố định vào được. */
export function newClickId(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < CLICK_ID_LEN; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}

/** Chỉ chữ thường + số, đúng độ dài. Dùng để lọc rác trước khi tra DB, và để nhận ra một `sid`
 *  lấy từ API upstream có phải mã của mình hay không (link cũ dùng sid tự đặt tay như
 *  "CJ_Trip_HK_13.8" — không phải, và không được nhận nhầm). */
export function isClickId(s: string | null | undefined): boolean {
  return !!s && s.length === CLICK_ID_LEN && /^[0-9a-z]+$/.test(s);
}

export interface UpstreamTarget { url: string; error?: string }

/**
 * Gắn mã click vào link upstream. Giữ nguyên query sẵn có của link (link CJ mã hoá dạng
 * `/kj122zw…` không có query, nhưng link Awin/Impact thì có) — nối thêm chứ không ghi đè.
 */
export function upstreamUrl(network: string, baseUrl: string, clickId: string): UpstreamTarget {
  const param = SUB_PARAM[network];
  if (param === undefined) return { url: baseUrl, error: `network lạ: ${network}` };
  if (param === null) return { url: baseUrl, error: `${network} không có ô sub-id dùng được` };
  let u: URL;
  try { u = new URL(baseUrl); } catch { return { url: baseUrl, error: 'upstream_url không hợp lệ' }; }
  // set chứ không append: link đã có sẵn ô đó (dán nhầm cả sid cũ vào) thì phải bị ĐÈ, để nguyên
  // là gửi đi hai giá trị và upstream giữ cái nào thì tuỳ nó — mất dấu mà không báo lỗi.
  u.searchParams.set(param, clickId);
  return { url: u.toString() };
}

/** Bốn ô sub-id của PUBLISHER. Đặt tên theo utm vì net VN (AccessTrade) dùng đúng bộ này — người
 *  chạy quảng cáo đã quen tay, và link dán vào Google/Facebook Ads thì utm là thứ họ vốn phải điền.
 *  Mình không diễn giải nội dung, chỉ lưu và trả lại nguyên văn trong báo cáo. */
export const UTM_SLOTS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
export type UtmSlot = (typeof UTM_SLOTS)[number];
export type Utm = Partial<Record<UtmSlot, string>>;

/** Cắt ô sub-id của publisher khỏi query. Bỏ ô rỗng, cắt 200 ký tự để một link quảng cáo dị dạng
 *  không bơm cả trang vào DB. */
export function readUtm(params: URLSearchParams): Utm {
  const out: Utm = {};
  for (const k of UTM_SLOTS) {
    const v = params.get(k)?.trim();
    if (v) out[k] = v.slice(0, 200);
  }
  return out;
}

/** Link mà publisher dán ra ngoài. */
export function trackingUrl(origin: string, offerSlug: string, pubSlug: string, utm: Utm = {}): string {
  const u = new URL(`/c/${encodeURIComponent(offerSlug)}`, origin);
  u.searchParams.set('p', pubSlug);
  for (const k of UTM_SLOTS) if (utm[k]) u.searchParams.set(k, utm[k]!);
  return u.toString();
}

// ── Kiểm dữ liệu trước khi ghi ───────────────────────────────────────────────
// Nằm CÙNG file với SUB_PARAM chứ không tách ra: tách thì file kia phải import runtime `./link`,
// mà node chạy trần đòi đuôi .ts còn tsc thì cấm (TS5097) → `node scripts/check-*.ts` gãy. Ở đây
// module vẫn không import runtime cái gì nên vừa test được vừa dùng được trong 'use server'.
/** slug nằm TRONG link publisher đã dán ra ngoài → chặn ký tự lạ ngay từ lúc tạo, để không phải
 *  đi encode ở mọi chỗ dùng về sau, và để không ai đặt slug có dấu/khoảng trắng rồi link gãy. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

export function checkSlug(raw: string): string | null {
  return SLUG_RE.test(raw.trim().toLowerCase())
    ? null
    : 'Slug: chỉ chữ thường, số và gạch ngang (2-41 ký tự)';
}

/** null = hợp lệ. Chuỗi = câu báo lỗi hiện thẳng cho người dùng. */
export function checkOffer(v: { slug: string; name: string; network: string; upstreamUrl: string }): string | null {
  const s = checkSlug(v.slug);
  if (s) return s;
  if (!v.name.trim()) return 'Thiếu tên chiến dịch';
  // Network không có ô sub-id thì click đi ra là mất dấu. Chặn ở đây chứ đừng để phát hiện sau
  // vài tuần chạy quảng cáo — lúc đó tiền đã đi và không truy lại được.
  const param = SUB_PARAM[v.network];
  if (param === undefined) return `Network lạ: ${v.network}`;
  if (param === null) return `${v.network} không có ô sub-id dùng được — chưa theo dõi được đơn`;
  try { new URL(v.upstreamUrl); } catch { return 'Link upstream không phải URL hợp lệ'; }
  return null;
}

export function checkPublisher(v: { slug: string; name: string }): string | null {
  const s = checkSlug(v.slug);
  if (s) return s;
  return v.name.trim() ? null : 'Thiếu tên publisher';
}
