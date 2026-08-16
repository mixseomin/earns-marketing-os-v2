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

/** Host mà link theo dõi phải mang. Admin mở backend ở host khác, nhưng link đem đi phát luôn là
 *  host publisher — lấy `headers().host` thì admin copy ra link nội bộ mà không ai nhận ra. */
export const PUB_ORIGIN = process.env.NEXT_PUBLIC_PUB_ORIGIN || 'https://pub.on.tc';

/**
 * Tên miền riêng của publisher → origin dùng để dựng link. Bỏ trống thì về host chung.
 *
 * Nhận cả 'go.x.com', 'https://go.x.com', 'https://go.x.com/' — người điền sẽ dán đủ kiểu, và một
 * dấu gạch thừa là ra link `https://go.x.com//t/abc`. Chuẩn hoá MỘT chỗ, không đi sửa ở mọi nơi đọc.
 */
export function originOf(linkDomain: string | null | undefined): string {
  const h = (linkDomain ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return h ? `https://${h}` : PUB_ORIGIN;
}

/** Host hợp lệ để phục vụ link: chữ thường, có dấu chấm, không path/khoảng trắng. */
export function checkLinkDomain(raw: string): string | null {
  const h = raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!h) return null;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(h)
    ? null
    : 'Tên miền: chỉ phần host (vd go.militarycalc.com), không kèm đường dẫn';
}

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

/** Token của MỘT cặp (publisher × chiến dịch). 12 ký tự — đủ mờ để không đoán ra link người khác,
 *  đủ ngắn để đọc qua điện thoại. Khác mã click ở chỗ nó BỀN: một token cho cả đời chiến dịch đó,
 *  còn mã click sinh mới mỗi lượt bấm. */
export const LINK_TOKEN_LEN = 12;

export function newLinkToken(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < LINK_TOKEN_LEN; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}

/**
 * Link mà publisher dán ra ngoài. Không còn tham số nào để họ sửa sai: publisher và chiến dịch nằm
 * TRONG token, không phải trong query. Đổi `?p=` sang người khác, xoá nó, gõ nhầm slug — cả ba
 * đường hỏng cũ đều không còn cửa.
 *
 * Bốn ô utm là phần THÊM: gõ hỏng thì cùng lắm mất nhãn phụ, click vẫn về đúng chủ.
 */
export function trackingUrl(origin: string, token: string, utm: Utm = {}): string {
  const u = new URL(`/t/${encodeURIComponent(token)}`, origin);
  for (const k of UTM_SLOTS) if (utm[k]) u.searchParams.set(k, utm[k]!);
  return u.toString();
}

// ── Kiểm dữ liệu trước khi ghi ───────────────────────────────────────────────
// Nằm CÙNG file với SUB_PARAM chứ không tách ra: tách thì file kia phải import runtime `./link`,
// mà node chạy trần đòi đuôi .ts còn tsc thì cấm (TS5097) → `node scripts/check-*.ts` gãy. Ở đây
// module vẫn không import runtime cái gì nên vừa test được vừa dùng được trong 'use server'.
/**
 * Đoán network từ TÊN MIỀN của link affiliate.
 *
 * Danh mục Directus bỏ trống cột network ở gần hết các dòng (2.755/2.894 dòng là awin1.com mà cột
 * network rỗng). Không đoán thì `trackable=false` toàn bảng → checkOffer chặn hết, và danh mục
 * 2.894 dòng trở thành đồ trưng bày: không dựng được chiến dịch nào từ nó. Tên miền redirect là
 * thứ đáng tin hơn cột metadata, vì nó nằm ngay trong link sẽ chạy.
 */
const HOST_NETWORK: Array<[RegExp, string]> = [
  [/(^|\.)(awin1|zenaps)\.com$/, 'awin'],
  [/(^|\.)(dpbolvw|anrdoezrs|jdoqocy|kqzyfj|tkqlhce|qksrv|emjcd)\.(net|com)$/, 'cj'],
  [/(^|\.)(sjv\.io|pxf\.io|ojrq\.net)$/, 'impact'],
  [/(^|\.)linksynergy\.com$/, 'rakuten'],
  [/(^|\.)clickbank\.net$/, 'clickbank'],
  [/(^|\.)adpia\.vn$/, 'adpia'],
  [/(^|\.)tkglobal\.asia$/, 'tkglobal'],
  [/(^|\.)masoffer\.com$/, 'masoffer'],
  [/(^|\.)(travelpayouts\.com|tp\.media)$/, 'travelpayouts'],
];

export function networkFromUrl(url: string): string {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return ''; }
  return HOST_NETWORK.find(([re]) => re.test(host))?.[1] ?? '';
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

/** Tên tự do → slug hợp lệ. Bỏ dấu tiếng Việt trước, nếu không "Đặt vé" thành "t-v" cụt nghĩa. */
export function slugify(raw: string): string {
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 41)
    .replace(/-+$/, '');
}

/** slug nằm TRONG link publisher đã dán ra ngoài → chặn ký tự lạ ngay từ lúc tạo, để không phải
 *  đi encode ở mọi chỗ dùng về sau, và để không ai đặt slug có dấu/khoảng trắng rồi link gãy. */
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
