// Báo cáo của nền tảng network: nối ĐƠN (từ API upstream) về CLICK (bảng của mình) → ra publisher.
//
// Không có bảng conversions. Đơn đọc thẳng API mỗi lần rồi join theo `sub` (chính là click_id mình
// nhét vào ô sub-id lúc redirect). Thêm bảng khi cần sổ cái để trả tiền — trước đó nó chỉ là bản
// sao chậm hơn của API, mà lại thêm một chỗ để lệch.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { cjConversions, awinConversions } from '@/lib/revenue/networks';
import { cjSettleState, awinSettleState, type SettleState } from './status';
import { pubPayout } from '@/lib/offer-payout';

export interface NetConversion {
  upstreamId: string;
  network: string;
  date: string;
  advertiser: string;
  commission: number;      // upstream trả MÌNH
  gross: number;
  state: SettleState;
  clickId: string | null;
  publisher: string | null;   // slug; null = đơn không nối được về ai
  publisherName: string | null;
  offer: string | null;
  /** Mức đang niêm yết cho publisher trên chiến dịch này — KHÔNG phải mức upstream. Dùng để tính
   *  đúng số tiền của họ; null = "thoả thuận", rơi về mức chia mặc định. */
  pubRate: string | null;
  utm: string[];              // 4 ô sub-id của publisher, đã bỏ ô trống
}

export interface PubStat {
  publisher: string;
  publisherName: string;
  clicks: number;
  orders: number;
  approved: number;         // tiền ĐÃ chốt — con số duy nhất dùng để trả
  holding: number;          // tạm duyệt, còn đổi được
  pending: number;
}

export interface NetworkReport {
  conversions: NetConversion[];
  pubs: PubStat[];
  /** Đơn về mà không nối được về click nào. Con số này > 0 nghĩa là đang mất dấu tiền — phải hiện,
   *  không được lặng lẽ bỏ ra khỏi bảng. */
  unmatched: number;
  errors: string[];
}

interface ClickRow {
  click_id: string; pub_slug: string | null; pub_name: string | null; offer_slug: string | null;
  /** Mức của PUBLISHER trên chính chiến dịch này: riêng đè chung. null = chưa niêm yết mức nào. */
  pub_rate: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null;
}

export async function networkReport(sinceDays = 90): Promise<NetworkReport> {
  const db = getDb();
  if (!db) return { conversions: [], pubs: [], unmatched: 0, errors: ['DATABASE_URL chưa cấu hình'] };
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString().slice(0, 10);

  const [cj, awin, clickRows, pubRows] = await Promise.all([
    cjConversions(since),
    awinConversions(since),
    db.execute(sql`
      SELECT c.click_id, p.slug AS pub_slug, p.name AS pub_name, o.slug AS offer_slug,
             COALESCE(r.publisher_rate, o.publisher_rate) AS pub_rate,
             c.utm_source, c.utm_medium, c.utm_campaign, c.utm_content
      FROM net_clicks c
      LEFT JOIN net_publishers p ON p.id = c.publisher_id
      LEFT JOIN net_offers o ON o.id = c.offer_id
      LEFT JOIN net_publisher_offers r ON r.offer_id = c.offer_id AND r.publisher_id = c.publisher_id`),
    // Số click đếm RIÊNG bằng SQL chứ không đếm từ bảng trên: dòng backfill phải bị loại, và
    // publisher chưa có click nào vẫn phải xuất hiện với số 0 (không có mặt ≠ chưa ai bấm).
    db.execute(sql`
      SELECT p.slug, p.name,
             COUNT(c.id) FILTER (WHERE c.source = 'click' AND c.created_at >= ${since}::date)::int AS clicks
      FROM net_publishers p
      LEFT JOIN net_clicks c ON c.publisher_id = p.id
      GROUP BY p.slug, p.name ORDER BY p.name`),
  ]);

  const byClick = new Map<string, ClickRow>();
  for (const r of clickRows as unknown as ClickRow[]) byClick.set(r.click_id, r);

  // Mỗi network một cách đọc trạng thái, nhưng ra CÙNG bốn nấc — chỗ khác nhau duy nhất là hàm
  // settle. Thêm network sau này = thêm một dòng ở mảng này, không đụng phần join bên dưới.
  const sources: Array<{ network: string; rows: Array<{ id: string; date: string; channel: string; amount: number; gross?: number; sub?: string; state: SettleState }> }> = [
    { network: 'cj', rows: cj.rows.map((c) => ({
      id: c.id, date: c.date, channel: c.channel, amount: c.amount, gross: c.gross, sub: c.sub,
      state: cjSettleState(c.status, c.lockDate, c.amount),
    })) },
    { network: 'awin', rows: awin.rows.map((a) => ({
      id: a.id, date: a.date, channel: a.channel, amount: a.amount, gross: a.gross, sub: a.sub,
      state: awinSettleState(a.status, a.amount),
    })) },
  ];

  const conversions: NetConversion[] = sources.flatMap(({ network, rows }) => rows.map((c) => {
    const hit = c.sub ? byClick.get(c.sub) ?? null : null;
    return {
      upstreamId: `${network}:${c.id}`, network, date: c.date, advertiser: c.channel,
      commission: c.amount, gross: c.gross ?? c.amount,
      state: c.state,
      clickId: c.sub ?? null,
      publisher: hit?.pub_slug ?? null,
      publisherName: hit?.pub_name ?? null,
      offer: hit?.offer_slug ?? null,
      pubRate: hit?.pub_rate ?? null,
      utm: hit ? [hit.utm_source, hit.utm_medium, hit.utm_campaign, hit.utm_content].filter((x): x is string => !!x) : [],
    };
  }));

  const pubs: PubStat[] = (pubRows as unknown as Array<{ slug: string; name: string; clicks: number }>).map((p) => ({
    publisher: p.slug, publisherName: p.name, clicks: Number(p.clicks) || 0,
    orders: 0, approved: 0, holding: 0, pending: 0,
  }));
  const bySlug = new Map(pubs.map((p) => [p.publisher, p]));
  for (const c of conversions) {
    const p = c.publisher ? bySlug.get(c.publisher) : undefined;
    if (!p) continue;
    p.orders += 1;
    // Ba két riêng, KHÔNG cộng chung: publisher nhìn thấy tổng rồi tiêu, tới lúc đối soát bị cắt
    // thì đó là mình nợ họ một lời giải thích. `approved` mới là tiền trả được.
    if (c.state === 'approved') p.approved += c.commission;
    else if (c.state === 'holding') p.holding += c.commission;
    else if (c.state === 'pending') p.pending += c.commission;
  }

  return {
    conversions: conversions.sort((a, b) => b.date.localeCompare(a.date)),
    pubs: pubs.sort((a, b) => b.approved - a.approved || b.clicks - a.clicks),
    unmatched: conversions.filter((c) => !c.publisher).length,
    errors: [cj.error, awin.error].filter((e): e is string => !!e),
  };
}

// ── Góc nhìn PUBLISHER ───────────────────────────────────────────────────────

export interface PubConversion {
  upstreamId: string; date: string; advertiser: string;
  /** Tiền của PUBLISHER, đã trừ phần mình giữ. KHÔNG phải số upstream trả mình. */
  commission: number;
  state: SettleState; utm: string[];
  /** Đơn này ăn theo mức "thoả thuận" (chiến dịch chưa niêm yết mức nào) → số tiền là TẠM TÍNH. */
  negotiated: boolean;
}
export interface PubView {
  clicks: number; orders: number;
  approved: number; holding: number; pending: number;
  conversions: PubConversion[];
}

/**
 * Cắt báo cáo về đúng phần của MỘT publisher, và quy mọi khoản tiền về phần HỌ hưởng.
 *
 * `NetConversion.commission` là số upstream trả MÌNH. Đưa thẳng xuống portal là vừa lộ mức nhà vừa
 * hứa sai: publisher đọc thấy $19.75 rồi đến kỳ nhận $13.83 thì đó là một cuộc cãi nhau, không phải
 * một con số. Cũng bỏ luôn `network`/`clickId`/`gross` — nguồn hàng và giá đơn của nhà cung cấp
 * không phải việc của họ.
 */
export function pubView(report: NetworkReport, pubSlug: string): PubView {
  const me = report.pubs.find((p) => p.publisher === pubSlug);
  const conversions: PubConversion[] = report.conversions
    .filter((c) => c.publisher === pubSlug)
    .map((c) => ({
      upstreamId: c.upstreamId, date: c.date, advertiser: c.advertiser,
      // Tiền tính từ mức của CHÍNH cặp publisher×chiến dịch đó, không phải một hằng số chung.
      commission: pubPayout(c.gross, c.commission, c.pubRate),
      state: c.state, utm: c.utm,
      negotiated: c.pubRate == null,
    }));
  // Ba két cộng từ chính các đơn đã quy đổi. Cộng ở tầng PubStat rồi mới nhân hệ số là sai ngay khi
  // hai chiến dịch có hai mức khác nhau.
  const sum = (st: SettleState) =>
    Math.round(conversions.filter((c) => c.state === st).reduce((a, c) => a + c.commission, 0) * 100) / 100;
  return {
    clicks: me?.clicks ?? 0,
    orders: conversions.length,
    approved: sum('approved'), holding: sum('holding'), pending: sum('pending'),
    conversions,
  };
}
