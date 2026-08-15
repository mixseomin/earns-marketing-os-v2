// Hoa hồng AFFILIATE NETWORK theo NGÀY — nguồn thứ tư của lịch doanh thu (trang chủ + /revenue).
//
// Khác ba nguồn kia: adsense là quảng cáo, gumroad + product_stats là sản phẩm mình bán. Đây là
// tiền network trả cho mình khi bán hàng của người khác — cùng trục ngày với chúng, nên nằm luôn
// trong `getRevenueByDay` thay vì đẻ ra một trang riêng.
//
// KHÔNG bảng, KHÔNG cron — đọc thẳng API mỗi lần, như `gumroad/products.ts`: cả hai network đều
// trả về từng giao dịch kèm ngày, nên snapshot vào DB chỉ là bản sao chậm hơn. Thêm bảng khi nào
// cần chuỗi dài hơn cửa sổ API cho phép (xem MAX_CHUNKS) hoặc khi số tiền đủ lớn để cần lịch sử
// bất biến — hôm nay tổng cộng là 1 commission $19.75.
//
// Hai API, hai kiểu, cùng một giới hạn 31 ngày mỗi lần hỏi:
//   • CJ   — commission-detail v3, trả XML. GraphQL `publisherCommissions` KHÔNG dùng được: quét
//            29 cửa sổ tháng (2024-08 → 2026-08) nó trả count 0 trong khi v3 trả đúng commission
//            Trip.com $19.75. Cùng token, cùng publisher — chỉ endpoint là khác.
//   • Awin — /transactions, trả JSON.

import type { RevenueDayRow } from './by-day';

/** Tag cache của MỌI lời gọi API doanh thu (CJ · Awin · Gumroad · Directus product_stats).
 *  Nút "Kéo lại" gọi revalidateTag(REVENUE_TAG) để ép đọc lại NGAY, không ngồi chờ hết 5-10 phút.
 *  Khai báo ở đây chứ không tách file riêng: module này không import runtime cái gì, nên
 *  `node scripts/check-network-revenue.ts` vẫn nạp được (node cần đuôi .ts, tsc thì cấm — xem
 *  TS5097). Thêm nguồn doanh thu mới = gắn tag này vào fetch của nó, nút tự lo phần còn lại. */
export const REVENUE_TAG = 'revenue';

const CJ_PAT = process.env.CJ_PAT || '';
const CJ_CID = process.env.CJ_PUBLISHER_ID || '';
const AWIN_TOKEN = process.env.AWIN_TOKEN || '';
const AWIN_PUB = process.env.AWIN_PUBLISHER_ID || '';

/** Cả hai API đều từ chối khoảng > 31 ngày ("Unable to query commissions for date range over 31 days"). */
const CHUNK_DAYS = 31;
/** ~13 tháng. Xa hơn thì phải có bảng snapshot chứ không phải 120 lời gọi mỗi lần mở trang. */
const MAX_CHUNKS = 13;

export interface NetworkPart {
  rows: RevenueDayRow[];
  error?: string;
  /** Đã gọi được API thật (có credential) hay không. Không có credential thì KHÔNG phải "kiếm $0" —
   *  hai chuyện khác hẳn nhau, và bộ lọc phải nói đúng chuyện nào. */
  scanned: boolean;
}

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Cắt [since, until] thành các cửa sổ ≤ 31 ngày, mới nhất trước. Hai cửa sổ liền nhau DÙNG CHUNG
 * ngày biên (API tính bao gồm cả hai đầu) → giao dịch ở biên trả về hai lần; khử trùng bằng id
 * giao dịch ở dưới, an toàn hơn là căn ngày cho khéo.
 */
export function windows(since: string, until: string): Array<[string, string]> {
  const s = Date.parse(`${since}T00:00:00Z`);
  const u = Date.parse(`${until}T00:00:00Z`);
  if (!Number.isFinite(s) || !Number.isFinite(u) || u <= s) return [];
  const out: Array<[string, string]> = [];
  for (let end = u; end > s && out.length < MAX_CHUNKS; ) {
    const start = Math.max(s, end - CHUNK_DAYS * 86400_000);
    out.push([ymd(start), ymd(end)]);
    end = start;
  }
  return out;
}

/** Rút một thẻ XML phẳng. CJ trả cấu trúc cố định, không lồng nhau → regex là đủ, không cần parser. */
export function xmlTag(block: string, tag: string): string {
  return new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(block)?.[1] ?? '';
}

/** XML CJ → dòng doanh thu. Xuất ra để test được mà không cần token. */
export interface CjExtra {
  id: string;
  /** action-status của CJ (new/locked/closed/extended/corrected) + locking-date — hai thứ quyết
   *  định đơn đã chốt hay chưa. Nền tảng network dùng để hiện trạng thái đối soát cho publisher;
   *  lịch doanh thu bỏ qua. Xem lib/network/status.ts. */
  status: string;
  lockDate: string;
}

export function parseCj(xml: string): Array<RevenueDayRow & CjExtra> {
  const out: Array<RevenueDayRow & CjExtra> = [];
  for (const m of xml.matchAll(/<commission>([\s\S]*?)<\/commission>/g)) {
    const b = m[1]!;
    // event-date = ngày KHÁCH mua. posting-date là ngày CJ ghi sổ, lệch vài giờ tới vài ngày —
    // lịch doanh thu vẽ theo ngày phát sinh mới khớp với việc mình làm hôm đó.
    const date = xmlTag(b, 'event-date').slice(0, 10);
    const amount = Number(xmlTag(b, 'commission-amount'));
    const id = xmlTag(b, 'commission-id');
    if (!date || !Number.isFinite(amount) || amount === 0) continue;
    out.push({
      id, date, source: 'affiliate', group: 'cj',
      channel: xmlTag(b, 'advertiser-name') || 'unknown',
      // `sid` = ô sub-id duy nhất của CJ, mình tự đặt lúc dựng link. Đây là NƠI DUY NHẤT nó quay
      // về: `performanceReport/sid.json` trả 404 và dropdown Performance không có chiều nào là SID.
      sub: xmlTag(b, 'sid') || undefined,
      status: xmlTag(b, 'action-status'),
      lockDate: xmlTag(b, 'locking-date'),
      // v3 trả số theo đơn vị tiền của TÀI KHOẢN publisher; tài khoản này để USD (ngưỡng rút
      // $50/$100, balance CJ báo bằng $). Đổi tài khoản sang tiền khác thì phải quy đổi ở đây.
      amount,
      gross: Number(xmlTag(b, 'sale-amount')) || amount,
    });
  }
  return out;
}

// ── Phễu click → đơn, theo LINK ──────────────────────────────────────────────
//
// API commission chỉ có ĐƠN. Muốn biết một camp đốt bao nhiêu click mới ra đơn thì phải lấy chỗ
// khác, và chỗ đó không nằm trong bộ API công khai: nó là endpoint của chính webapp
// members.cj.com. Điểm khiến nó dùng được từ server là nó nhận đúng PAT (đã thử: 200 + JSON
// thật, không cookie phiên nào) — nếu không thì đã phải nuôi một phiên đăng nhập, và bỏ.
//
// KHÔNG có chiều SID ở đây. Đã kiểm ba đường: `sid.json` → 404 · dropdown Performance chỉ có
// Website/Link/Advertiser/Advertiser-by-Website/Advertiser-Rank/Action/Product/Widget · bộ lọc
// Transactions không có SID. Nên muốn tách click theo camp thì phải tách LINK, mỗi camp một link.

/** Tổng của một link affiliate trong khoảng đang xem. Không có trục ngày — trục đó lịch lo rồi. */
export interface LinkPerfRow {
  network: string;
  advertiser: string;
  link: string;
  linkId: string;
  clicks: number;
  sales: number;
  commission: number;
  saleAmount: number;
}

interface CjPerfRec {
  advertiserName?: string; linkId?: number | string; linkName?: string;
  clicks?: number | string; sales?: number | string;
  publisherCommission?: number | string; saleAmount?: number | string;
}

// CJ trộn kiểu trong CÙNG một trường: `19.754` (số) khi có tiền, `"0.000"` (chuỗi) khi không.
const num = (x: unknown) => Number(x) || 0;

/** JSON performanceReport → dòng theo link. Xuất ra để test được mà không cần token. */
export function parseLinkPerf(json: unknown): LinkPerfRow[] {
  const rec = (json as { records?: { record?: CjPerfRec | CjPerfRec[] } })?.records?.record;
  // CJ trả OBJECT khi đúng một dòng, MẢNG khi nhiều dòng, và chuỗi rỗng khi không có gì.
  // Không bọc lại thì `.map` nổ đúng lúc tài khoản chỉ có một link — tức là lúc mới bắt đầu.
  const list = Array.isArray(rec) ? rec : rec && typeof rec === 'object' ? [rec] : [];
  const m = new Map<string, LinkPerfRow>();
  for (const r of list) {
    const linkId = String(r.linkId ?? '');
    if (!linkId) continue;
    const cur = m.get(linkId) ?? {
      network: 'cj', advertiser: r.advertiserName || 'unknown',
      link: r.linkName || linkId, linkId, clicks: 0, sales: 0, commission: 0, saleAmount: 0,
    };
    // Cộng dồn phòng khi gọi với trendPeriod theo ngày; với NoTrend thì mỗi link đúng một dòng.
    cur.clicks += num(r.clicks);
    cur.sales += num(r.sales);
    cur.commission += num(r.publisherCommission);
    cur.saleAmount += num(r.saleAmount);
    m.set(linkId, cur);
  }
  return [...m.values()].sort((a, b) => b.commission - a.commission || b.clicks - a.clicks);
}

async function cjLinkPerf(since: string, until: string): Promise<{ rows: LinkPerfRow[]; error?: string }> {
  if (!CJ_PAT || !CJ_CID) return { rows: [] };
  // `allowAllDateRanges=true` bỏ luôn trần 31 ngày của API commission → cả năm trong MỘT lời gọi.
  // `NoTrend` = tổng theo link, không tách ngày (giá trị lấy từ chính dropdown, `NONE` bị 400).
  const url = `https://members.cj.com/member/publisher/${encodeURIComponent(CJ_CID)}/performanceReport/link.json`
    + `?startDate=${since}&endDate=${until}&allowAllDateRanges=true&trendPeriod=NoTrend`
    + `&columnSort=${encodeURIComponent('publisherCommission\tDESC')}&startRow=1&endRow=200`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${CJ_PAT}` }, next: { revalidate: 600, tags: [REVENUE_TAG] } });
    if (!res.ok) return { rows: [], error: `cj link-perf: HTTP ${res.status}` };
    return { rows: parseLinkPerf(await res.json()) };
  } catch (e) { return { rows: [], error: `cj link-perf: ${(e as Error).message}` }; }
}

interface AwinTxn {
  id?: number | string;
  transactionDate?: string;
  transactionStatus?: string;
  /** Trạng thái đối soát của Awin: pending | approved | declined (docs Publisher API GET
   *  transactions). Đây mới là ô quyết định tiền có về hay không — `transactionStatus` là chuyện
   *  khác. Giá trị lạ thì coi như chưa chốt, đừng đoán thành đã duyệt. */
  commissionStatus?: string;
  advertiserName?: string;
  commissionAmount?: { amount?: number; currency?: string };
  saleAmount?: { amount?: number; currency?: string };
  /** Ô sub-id của publisher. Awin cho 6 ô (clickRef…clickRef6); mình chỉ nhét mã click vào ô ĐẦU,
   *  xem SUB_PARAM.awin = 'clickref'. */
  clickRefs?: { clickRef?: string };
}

export interface AwinExtra { id: string; status: string; sub?: string }

/** Đơn Awin dạng ĐẦY ĐỦ (kèm clickRef + trạng thái) — nền tảng network nối đơn về publisher bằng
 *  cái này. Cùng đường lấy với lịch doanh thu, để hai màn không nói hai con số. */
export function parseAwinFull(txns: AwinTxn[]): Array<RevenueDayRow & AwinExtra> {
  const out: Array<RevenueDayRow & AwinExtra> = [];
  for (const t of txns) {
    const date = String(t.transactionDate ?? '').slice(0, 10);
    const amount = Number(t.commissionAmount?.amount);
    if (!date || !Number.isFinite(amount)) continue;
    // KHÔNG bỏ dòng declined như parseAwin: ở đây đơn bị huỷ vẫn phải hiện, vì publisher cần thấy
    // đơn của mình bị huỷ chứ không phải thấy nó biến mất không lời nào.
    out.push({
      id: String(t.id ?? `${date}-${t.advertiserName ?? ''}-${amount}`), date, source: 'affiliate', group: 'awin',
      channel: t.advertiserName || 'unknown',
      amount, gross: Number(t.saleAmount?.amount) || amount,
      status: (t.commissionStatus ?? t.transactionStatus ?? '').toLowerCase(),
      sub: t.clickRefs?.clickRef || undefined,
    });
  }
  return out;
}

export async function awinConversions(since: string): Promise<{ rows: Array<RevenueDayRow & AwinExtra>; error?: string }> {
  if (!AWIN_TOKEN || !AWIN_PUB) return { rows: [], error: 'awin: chưa có AWIN_TOKEN/AWIN_PUBLISHER_ID' };
  const wins = windows(since, ymd(Date.now() + 86400_000));
  const errs: string[] = [];
  const seen = new Map<string, RevenueDayRow & AwinExtra>();
  await Promise.all(wins.map(async ([start, end]) => {
    const url = `https://api.awin.com/publishers/${encodeURIComponent(AWIN_PUB)}/transactions/`
      + `?startDate=${start}T00%3A00%3A00&endDate=${end}T00%3A00%3A00&timezone=UTC&dateType=transaction`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${AWIN_TOKEN}` }, next: { revalidate: 600, tags: [REVENUE_TAG] } });
      if (!res.ok) { errs.push(`HTTP ${res.status} (${start})`); return; }
      const j = await res.json();
      if (!Array.isArray(j)) { errs.push(`trả về không phải mảng (${start})`); return; }
      for (const r of parseAwinFull(j as AwinTxn[])) seen.set(r.id, r);
    } catch (e) { errs.push(`${(e as Error).message} (${start})`); }
  }));
  return { rows: [...seen.values()], error: errs.length ? `awin: ${errs.join('; ')}` : undefined };
}

/** JSON Awin → dòng doanh thu + danh sách tiền tệ phải bỏ qua (không tự bịa tỉ giá). */
export function parseAwin(txns: AwinTxn[]): { rows: Array<RevenueDayRow & { id: string }>; skipped: Set<string> } {
  const rows: Array<RevenueDayRow & { id: string }> = [];
  const skipped = new Set<string>();
  for (const t of txns) {
    // declined = Awin đã huỷ, tiền không bao giờ về. pending vẫn tính (nó là tiền đang chờ duyệt,
    // hiện đúng bản chất của lịch) — trạng thái đi kèm trong tooltip qua channel.
    if ((t.transactionStatus ?? '').toLowerCase() === 'declined') continue;
    const date = String(t.transactionDate ?? '').slice(0, 10);
    const amount = Number(t.commissionAmount?.amount);
    if (!date || !Number.isFinite(amount) || amount === 0) continue;
    // ponytail: chỉ nhận USD. Tiền khác thì BỎ và nói ra, không nhân bừa một tỉ giá — đúng lỗi
    // "CZK 100 = $100" đã mắc một lần ở cột AOV. Có giao dịch ngoại tệ thật thì mới thêm quy đổi.
    const cur = (t.commissionAmount?.currency ?? 'USD').toUpperCase();
    if (cur !== 'USD') { skipped.add(cur); continue; }
    rows.push({
      id: String(t.id ?? `${date}-${t.advertiserName ?? ''}-${amount}`), date, source: 'affiliate', group: 'awin',
      channel: t.advertiserName || 'unknown',
      amount, gross: Number(t.saleAmount?.amount) || amount,
    });
  }
  return { rows, skipped };
}

/** Đơn CJ dạng ĐẦY ĐỦ (kèm sid + trạng thái đối soát) — nền tảng network dùng cái này.
 *  `cjPart` bên dưới chỉ là cùng dữ liệu đó cắt gọn cho lịch doanh thu; MỘT đường lấy, hai cách
 *  đọc, để hai màn hình không bao giờ nói hai con số khác nhau. */
export async function cjConversions(since: string): Promise<{ rows: Array<RevenueDayRow & CjExtra>; error?: string }> {
  if (!CJ_PAT || !CJ_CID) return { rows: [], error: 'cj: chưa có CJ_PAT/CJ_PUBLISHER_ID' };
  const wins = windows(since, ymd(Date.now() + 86400_000));
  const errs: string[] = [];
  const seen = new Map<string, RevenueDayRow & CjExtra>();
  await Promise.all(wins.map(async ([start, end]) => {
    const url = `https://commission-detail.api.cj.com/v3/commissions?requestor-cid=${encodeURIComponent(CJ_CID)}`
      + `&date-type=event&start-date=${start}&end-date=${end}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${CJ_PAT}` }, next: { revalidate: 600, tags: [REVENUE_TAG] } });
      if (!res.ok) { errs.push(`HTTP ${res.status} (${start})`); return; }
      for (const r of parseCj(await res.text())) seen.set(r.id, r);
    } catch (e) { errs.push(`${(e as Error).message} (${start})`); }
  }));
  return { rows: [...seen.values()], error: errs.length ? `cj: ${errs.join('; ')}` : undefined };
}

async function cjPart(wins: Array<[string, string]>): Promise<NetworkPart> {
  if (!CJ_PAT || !CJ_CID) return { rows: [], scanned: false, error: 'cj: chưa có CJ_PAT/CJ_PUBLISHER_ID' };
  const r = await cjConversions(wins[wins.length - 1]?.[0] ?? ymd(Date.now()));
  return { rows: r.rows, scanned: true, error: r.error };
}

async function awinPart(wins: Array<[string, string]>): Promise<NetworkPart> {
  if (!AWIN_TOKEN || !AWIN_PUB) return { rows: [], scanned: false, error: 'awin: chưa có AWIN_TOKEN/AWIN_PUBLISHER_ID' };
  const errs: string[] = [];
  const skipped = new Set<string>();
  const seen = new Map<string, RevenueDayRow>();
  await Promise.all(wins.map(async ([start, end]) => {
    const url = `https://api.awin.com/publishers/${encodeURIComponent(AWIN_PUB)}/transactions/`
      + `?startDate=${start}T00%3A00%3A00&endDate=${end}T00%3A00%3A00&timezone=UTC&dateType=transaction`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${AWIN_TOKEN}` }, next: { revalidate: 600, tags: [REVENUE_TAG] } });
      if (!res.ok) { errs.push(`HTTP ${res.status} (${start})`); return; }
      const j = await res.json();
      if (!Array.isArray(j)) { errs.push(`trả về không phải mảng (${start})`); return; }
      const p = parseAwin(j as AwinTxn[]);
      for (const r of p.rows) seen.set(r.id, r);
      for (const c of p.skipped) skipped.add(c);
    } catch (e) { errs.push(`${(e as Error).message} (${start})`); }
  }));
  if (skipped.size) errs.push(`bỏ qua giao dịch ${[...skipped].join('/')} — chưa có quy đổi sang USD`);
  return { rows: [...seen.values()], scanned: true, error: errs.length ? `awin: ${errs.join('; ')}` : undefined };
}

// Một bảng duy nhất: thêm network = thêm một dòng ở đây, không phải sửa thêm hằng số nào khác.
const PULLERS: Record<string, (wins: Array<[string, string]>) => Promise<NetworkPart>> = { awin: awinPart, cj: cjPart };

export interface NetworkRevenue { rows: RevenueDayRow[]; error?: string; scanned: string[]; linkPerf: LinkPerfRow[] }

/** Hoa hồng network theo ngày trong [since, hôm nay]. Một network hỏng không kéo network kia chết theo. */
export async function networkRows(since: string): Promise<NetworkRevenue> {
  const until = ymd(Date.now() + 86400_000);          // +1 ngày: API tính tới đầu ngày `end`
  const wins = windows(since, until);
  if (!wins.length) return { rows: [], scanned: [], linkPerf: [] };
  const keys = Object.keys(PULLERS);
  const [parts, perf] = await Promise.all([
    Promise.all(keys.map((k) => PULLERS[k]!(wins))),
    cjLinkPerf(since, until),
  ]);
  const errs = parts.map((p) => p.error).filter((x): x is string => !!x);
  if (perf.error) errs.push(perf.error);
  // Cửa sổ bị chặn ở 13 tháng — nói ra, đừng để nhìn như "trước đó không kiếm được đồng nào".
  if (wins.length === MAX_CHUNKS) errs.push(`network: chỉ quét được ${MAX_CHUNKS * CHUNK_DAYS} ngày gần nhất (giới hạn 31 ngày/lần gọi)`);
  return {
    rows: parts.flatMap((p) => p.rows),
    error: errs.length ? errs.join(' · ') : undefined,
    // Chỉ net GỌI ĐƯỢC API mới vào danh sách → bộ lọc hiện "awin $0.00" đúng nghĩa "đã kiểm, không
    // có tiền". Net thiếu credential không được đội lốt $0, nó nằm ở dòng lỗi.
    scanned: keys.filter((_, i) => parts[i]!.scanned),
    linkPerf: perf.rows,
  };
}
