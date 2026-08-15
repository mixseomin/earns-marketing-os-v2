// Đọc/ghi dữ liệu nền tảng network. Tách khỏi report.ts (report = số liệu, đây = danh mục).

import { getDb } from '@mos2/db';
import { listAffiliateOffers } from '@/lib/actions/offers';
import { SUB_PARAM, networkFromUrl } from './link';
import { derivePubRate } from '@/lib/offer-payout';
import { sql } from 'drizzle-orm';

export interface Offer {
  id: number; slug: string; name: string; network: string;
  advertiser: string | null; category: string | null; upstreamUrl: string;
  upstreamRate: string | null; publisherRate: string | null; terms: string | null;
  active: boolean; clicks: number;
}

export interface Publisher {
  id: number; slug: string; name: string; kind: string; status: string; note: string | null;
  /** Danh tính RIÊNG của publisher — không phải user MOS2. Xem lib/network/auth.ts. */
  email: string | null;
  hasPassword: boolean;
}

export interface Registration {
  id: number; status: string;
  /** Giá/tỉ lệ RIÊNG cho publisher này trên chiến dịch này. null = ăn theo mức chung của offer. */
  publisherRate: string | null;
  /** Hai MỐC để nhìn vào mà đặt giá riêng: upstream trả mình bao nhiêu (trần), và mức chung đang
   *  áp cho mọi publisher. Không có hai cột này thì ô "giá riêng" là con số lơ lửng không so với gì. */
  offerUpstreamRate: string | null;
  offerPublisherRate: string | null;
  publisherId: number; publisherSlug: string; publisherName: string;
  offerId: number; offerSlug: string; offerName: string;
  requestedAt: string;
}

export async function listOffers(): Promise<Offer[]> {
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`
    SELECT o.*, COUNT(c.id) FILTER (WHERE c.source = 'click')::int AS clicks
    FROM net_offers o LEFT JOIN net_clicks c ON c.offer_id = o.id
    GROUP BY o.id ORDER BY o.active DESC, o.name`);
  return (r as unknown as Array<Record<string, unknown>>).map((x) => ({
    id: Number(x.id), slug: String(x.slug), name: String(x.name), network: String(x.network),
    advertiser: (x.advertiser as string) ?? null, category: (x.category as string) ?? null,
    upstreamUrl: String(x.upstream_url),
    upstreamRate: (x.upstream_rate as string) ?? null, publisherRate: (x.publisher_rate as string) ?? null,
    terms: (x.terms as string) ?? null, active: !!x.active, clicks: Number(x.clicks) || 0,
  }));
}

export async function listPublishers(): Promise<Publisher[]> {
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`SELECT * FROM net_publishers ORDER BY name`);
  return (r as unknown as Array<Record<string, unknown>>).map((x) => ({
    id: Number(x.id), slug: String(x.slug), name: String(x.name),
    kind: String(x.kind), status: String(x.status), note: (x.note as string) ?? null,
    email: (x.email as string) ?? null, hasPassword: !!x.password_hash,
  }));
}

export async function listRegistrations(onlyPending = false): Promise<Registration[]> {
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`
    SELECT r.id, r.status, r.requested_at, r.publisher_rate,
           o.upstream_rate AS o_up, o.publisher_rate AS o_pub,
           p.id AS pid, p.slug AS pslug, p.name AS pname,
           o.id AS oid, o.slug AS oslug, o.name AS oname
    FROM net_publisher_offers r
    JOIN net_publishers p ON p.id = r.publisher_id
    JOIN net_offers o ON o.id = r.offer_id
    ${onlyPending ? sql`WHERE r.status = 'pending'` : sql``}
    ORDER BY r.status = 'pending' DESC, r.requested_at DESC`);
  return (r as unknown as Array<Record<string, unknown>>).map((x) => ({
    id: Number(x.id), status: String(x.status),
    publisherRate: (x.publisher_rate as string) ?? null,
    offerUpstreamRate: (x.o_up as string) ?? null,
    offerPublisherRate: (x.o_pub as string) ?? null,
    publisherId: Number(x.pid), publisherSlug: String(x.pslug), publisherName: String(x.pname),
    offerId: Number(x.oid), offerSlug: String(x.oslug), offerName: String(x.oname),
    requestedAt: String(x.requested_at).slice(0, 10),
  }));
}

/** Chiến dịch của MỘT publisher, kèm trạng thái đăng ký — portal publisher dùng cái này.
 *  Trả về CẢ chiến dịch chưa đăng ký (status null) để họ thấy có gì mà xin chạy. */
/**
 * Chiến dịch mà MỘT publisher nhìn thấy.
 *
 * Kiểu trả về CỐ TÌNH không có `upstreamRate`/`upstreamUrl`/`network`: đó là mức nhà, link gốc và
 * nguồn hàng. Trước đây portal nhận nguyên `Offer` rồi mới chọn cái để hiện — và cột hoa hồng
 * fallback `publisherRate ?? upstreamRate` in thẳng "2.5% (CJ link 15534820)" ra cho publisher.
 * Không hiện thì vẫn nằm trong payload HTML, mở DevTools là đọc được. Chặn ở TẦNG DỮ LIỆU, không
 * chặn ở tầng vẽ.
 */
export interface PubOffer {
  id: number; slug: string; name: string;
  advertiser: string | null; category: string | null; terms: string | null;
  /** Mức publisher được hưởng. Riêng > chung > suy ra từ mức nhà. Không suy được thì null. */
  payout: string | null;
  regStatus: string | null; linkToken: string | null;
}

export async function offersForPublisher(publisherId: number): Promise<PubOffer[]> {
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`
    SELECT o.id, o.slug, o.name, o.advertiser, o.category, o.terms, o.upstream_rate, o.publisher_rate,
           r.publisher_rate AS reg_rate, r.status AS reg_status, r.link_token
    FROM net_offers o
    LEFT JOIN net_publisher_offers r ON r.offer_id = o.id AND r.publisher_id = ${publisherId}
    WHERE o.active
    ORDER BY r.status = 'approved' DESC NULLS LAST, o.name`);
  return (r as unknown as Array<Record<string, unknown>>).map((x) => ({
    id: Number(x.id), slug: String(x.slug), name: String(x.name),
    advertiser: (x.advertiser as string) ?? null, category: (x.category as string) ?? null,
    terms: (x.terms as string) ?? null,
    payout: (x.reg_rate as string) ?? (x.publisher_rate as string) ?? derivePubRate((x.upstream_rate as string) ?? null),
    regStatus: (x.reg_status as string) ?? null,
    linkToken: (x.link_token as string) ?? null,
  }));
}

/** Danh mục THEO GÓC NHÌN PUBLISHER: bỏ link gốc, bỏ tên network, mức hoa hồng đã quy về phần họ
 *  hưởng. Gửi `url` xuống là trao luôn link affiliate của tài khoản nhà cho người ngoài. */
export interface PubCatalogOffer {
  id: string; name: string; advertiser: string; vertical: string | null; payout: string | null;
}

export async function catalogForPublisher(): Promise<PubCatalogOffer[]> {
  return (await listCatalog())
    .filter((c) => c.trackable)
    .map((c) => ({
      id: c.id, name: c.name, advertiser: c.advertiser, vertical: c.vertical,
      payout: derivePubRate(c.rate),
    }));
}

/** Một dòng trong DANH MỤC affiliate của MOS2 (Directus `affiliate_programs`) — nguồn để dựng
 *  chiến dịch mà không phải gõ lại tên/link/tỉ lệ. */
export interface CatalogOffer {
  id: string; name: string; network: string; advertiser: string;
  url: string; rate: string | null; vertical: string | null;
  /** Network của dòng này có ô sub-id không. false = vẫn chọn được (để lấy tên/link/tỉ lệ) nhưng
   *  admin phải TỰ chọn network ở form, vì cái ghi trong danh mục không theo dõi được đơn. */
  trackable: boolean;
}

export async function listCatalog(): Promise<CatalogOffer[]> {
  const all = await listAffiliateOffers();
  const out: CatalogOffer[] = [];
  for (const o of all) {
    const net = o.network ?? '';
    // CHỈ đòi có link — không có link thì chọn vào cũng chẳng redirect đi đâu.
    // KHÔNG lọc theo network: dữ liệu thật có 2.894 dòng mang link, trong đó 2.763 dòng BỎ TRỐNG
    // network, số còn lại thuộc adpia/tkglobal/masoffer/travelpayouts/ecomobi — không cái nào có
    // ô sub-id. Lọc theo network là quét sạch danh mục, và picker biến mất không một lời giải thích.
    if (!o.affiliateUrl) continue;
    // Cột network trong Directus bỏ trống ở 2.755/2.894 dòng (đều là awin1.com). Đoán từ tên miền
    // của chính cái link sẽ chạy — không có bước này thì cả danh mục là trưng bày: trackable=false
    // toàn bảng, checkOffer chặn hết, không dựng nổi chiến dịch nào.
    const guessed = net || networkFromUrl(o.affiliateUrl);
    out.push({
      id: o.id, name: o.name, network: guessed, advertiser: o.brand || o.name,
      url: o.affiliateUrl, rate: o.commission, vertical: o.vertical,
      trackable: !!SUB_PARAM[guessed],
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
