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

const CJ_PAT = process.env.CJ_PAT || '';
const CJ_CID = process.env.CJ_PUBLISHER_ID || '';
const AWIN_TOKEN = process.env.AWIN_TOKEN || '';
const AWIN_PUB = process.env.AWIN_PUBLISHER_ID || '';

/** Cả hai API đều từ chối khoảng > 31 ngày ("Unable to query commissions for date range over 31 days"). */
const CHUNK_DAYS = 31;
/** ~13 tháng. Xa hơn thì phải có bảng snapshot chứ không phải 120 lời gọi mỗi lần mở trang. */
const MAX_CHUNKS = 13;

export interface NetworkPart { rows: RevenueDayRow[]; error?: string }
/** Network nào ĐÃ hỏi API thật trong lượt này — kể cả khi nó trả về 0 giao dịch. Bộ lọc cần biết:
 *  "awin $0.00" là đã kiểm và không có tiền, khác hẳn với awin biến mất khỏi màn hình. */
export const SCANNED_NETWORKS = ['awin', 'cj'] as const;

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
export function parseCj(xml: string): Array<RevenueDayRow & { id: string }> {
  const out: Array<RevenueDayRow & { id: string }> = [];
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
      // v3 trả số theo đơn vị tiền của TÀI KHOẢN publisher; tài khoản này để USD (ngưỡng rút
      // $50/$100, balance CJ báo bằng $). Đổi tài khoản sang tiền khác thì phải quy đổi ở đây.
      amount,
      gross: Number(xmlTag(b, 'sale-amount')) || amount,
    });
  }
  return out;
}

interface AwinTxn {
  id?: number | string;
  transactionDate?: string;
  transactionStatus?: string;
  advertiserName?: string;
  commissionAmount?: { amount?: number; currency?: string };
  saleAmount?: { amount?: number; currency?: string };
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
      id: String(t.id ?? `${date}-${amount}`), date, source: 'affiliate', group: 'awin',
      channel: t.advertiserName || 'unknown',
      amount, gross: Number(t.saleAmount?.amount) || amount,
    });
  }
  return { rows, skipped };
}

async function cjPart(wins: Array<[string, string]>): Promise<NetworkPart> {
  if (!CJ_PAT || !CJ_CID) return { rows: [], error: 'cj: chưa có CJ_PAT/CJ_PUBLISHER_ID' };
  const errs: string[] = [];
  const seen = new Map<string, RevenueDayRow>();
  await Promise.all(wins.map(async ([start, end]) => {
    const url = `https://commission-detail.api.cj.com/v3/commissions?requestor-cid=${encodeURIComponent(CJ_CID)}`
      + `&date-type=event&start-date=${start}&end-date=${end}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${CJ_PAT}` }, next: { revalidate: 600 } });
      if (!res.ok) { errs.push(`HTTP ${res.status} (${start})`); return; }
      for (const r of parseCj(await res.text())) seen.set(r.id, r);
    } catch (e) { errs.push(`${(e as Error).message} (${start})`); }
  }));
  return { rows: [...seen.values()], error: errs.length ? `cj: ${errs.join('; ')}` : undefined };
}

async function awinPart(wins: Array<[string, string]>): Promise<NetworkPart> {
  if (!AWIN_TOKEN || !AWIN_PUB) return { rows: [], error: 'awin: chưa có AWIN_TOKEN/AWIN_PUBLISHER_ID' };
  const errs: string[] = [];
  const skipped = new Set<string>();
  const seen = new Map<string, RevenueDayRow>();
  await Promise.all(wins.map(async ([start, end]) => {
    const url = `https://api.awin.com/publishers/${encodeURIComponent(AWIN_PUB)}/transactions/`
      + `?startDate=${start}T00%3A00%3A00&endDate=${end}T00%3A00%3A00&timezone=UTC&dateType=transaction`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${AWIN_TOKEN}` }, next: { revalidate: 600 } });
      if (!res.ok) { errs.push(`HTTP ${res.status} (${start})`); return; }
      const j = await res.json();
      if (!Array.isArray(j)) { errs.push(`trả về không phải mảng (${start})`); return; }
      const p = parseAwin(j as AwinTxn[]);
      for (const r of p.rows) seen.set(r.id, r);
      for (const c of p.skipped) skipped.add(c);
    } catch (e) { errs.push(`${(e as Error).message} (${start})`); }
  }));
  if (skipped.size) errs.push(`bỏ qua giao dịch ${[...skipped].join('/')} — chưa có quy đổi sang USD`);
  return { rows: [...seen.values()], error: errs.length ? `awin: ${errs.join('; ')}` : undefined };
}

/** Hoa hồng network theo ngày trong [since, hôm nay]. Một network hỏng không kéo network kia chết theo. */
export async function networkRows(since: string): Promise<NetworkPart> {
  const until = ymd(Date.now() + 86400_000);          // +1 ngày: API tính tới đầu ngày `end`
  const wins = windows(since, until);
  if (!wins.length) return { rows: [] };
  const [cj, awin] = await Promise.all([cjPart(wins), awinPart(wins)]);
  const errs = [cj.error, awin.error].filter((x): x is string => !!x);
  // Cửa sổ bị chặn ở 13 tháng — nói ra, đừng để nhìn như "trước đó không kiếm được đồng nào".
  if (wins.length === MAX_CHUNKS) errs.push(`network: chỉ quét được ${MAX_CHUNKS * CHUNK_DAYS} ngày gần nhất (giới hạn 31 ngày/lần gọi)`);
  return { rows: [...cj.rows, ...awin.rows], error: errs.length ? errs.join(' · ') : undefined };
}
