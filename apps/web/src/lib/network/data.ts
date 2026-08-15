// Đọc/ghi dữ liệu nền tảng network. Tách khỏi report.ts (report = số liệu, đây = danh mục).

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

export interface Offer {
  id: number; slug: string; name: string; network: string;
  advertiser: string | null; category: string | null; upstreamUrl: string;
  upstreamRate: string | null; publisherRate: string | null; terms: string | null;
  active: boolean; clicks: number;
}

export interface Publisher {
  id: number; slug: string; name: string; kind: string; status: string; note: string | null;
  userId: number | null;
}

export interface UserOption { id: number; email: string; name: string }

export async function listUsers(): Promise<UserOption[]> {
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`SELECT id, email, name FROM users ORDER BY name`);
  return (r as unknown as Array<Record<string, unknown>>).map((x) => ({ id: Number(x.id), email: String(x.email), name: String(x.name) }));
}

export interface Registration {
  id: number; status: string;
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
    userId: x.user_id === null || x.user_id === undefined ? null : Number(x.user_id),
  }));
}

export async function listRegistrations(onlyPending = false): Promise<Registration[]> {
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`
    SELECT r.id, r.status, r.requested_at,
           p.id AS pid, p.slug AS pslug, p.name AS pname,
           o.id AS oid, o.slug AS oslug, o.name AS oname
    FROM net_publisher_offers r
    JOIN net_publishers p ON p.id = r.publisher_id
    JOIN net_offers o ON o.id = r.offer_id
    ${onlyPending ? sql`WHERE r.status = 'pending'` : sql``}
    ORDER BY r.status = 'pending' DESC, r.requested_at DESC`);
  return (r as unknown as Array<Record<string, unknown>>).map((x) => ({
    id: Number(x.id), status: String(x.status),
    publisherId: Number(x.pid), publisherSlug: String(x.pslug), publisherName: String(x.pname),
    offerId: Number(x.oid), offerSlug: String(x.oslug), offerName: String(x.oname),
    requestedAt: String(x.requested_at).slice(0, 10),
  }));
}

/** Chiến dịch của MỘT publisher, kèm trạng thái đăng ký — portal publisher dùng cái này.
 *  Trả về CẢ chiến dịch chưa đăng ký (status null) để họ thấy có gì mà xin chạy. */
export async function offersForPublisher(publisherId: number): Promise<Array<Offer & { regStatus: string | null }>> {
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`
    SELECT o.*, r.status AS reg_status,
           COUNT(c.id) FILTER (WHERE c.source = 'click' AND c.publisher_id = ${publisherId})::int AS clicks
    FROM net_offers o
    LEFT JOIN net_publisher_offers r ON r.offer_id = o.id AND r.publisher_id = ${publisherId}
    LEFT JOIN net_clicks c ON c.offer_id = o.id
    WHERE o.active
    GROUP BY o.id, r.status ORDER BY r.status = 'approved' DESC NULLS LAST, o.name`);
  return (r as unknown as Array<Record<string, unknown>>).map((x) => ({
    id: Number(x.id), slug: String(x.slug), name: String(x.name), network: String(x.network),
    advertiser: (x.advertiser as string) ?? null, category: (x.category as string) ?? null,
    upstreamUrl: String(x.upstream_url),
    upstreamRate: (x.upstream_rate as string) ?? null, publisherRate: (x.publisher_rate as string) ?? null,
    terms: (x.terms as string) ?? null, active: !!x.active, clicks: Number(x.clicks) || 0,
    regStatus: (x.reg_status as string) ?? null,
  }));
}

/** Publisher gắn với user MOS2 đang đăng nhập. Chưa gắn thì portal nói rõ chứ không im lặng rỗng. */
export async function publisherForUser(userId: number): Promise<Publisher | null> {
  const db = getDb();
  if (!db) return null;
  const r = await db.execute(sql`SELECT * FROM net_publishers WHERE user_id = ${userId} AND status = 'active' LIMIT 1`);
  const x = (r as unknown as Array<Record<string, unknown>>)[0];
  return x ? {
    id: Number(x.id), slug: String(x.slug), name: String(x.name),
    kind: String(x.kind), status: String(x.status), note: (x.note as string) ?? null,
    userId: x.user_id === null || x.user_id === undefined ? null : Number(x.user_id),
  } : null;
}
