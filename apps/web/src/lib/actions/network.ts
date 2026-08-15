'use server';

// Hành động của nền tảng network: CRUD chiến dịch + publisher, duyệt đăng ký, đặt giá riêng.
//
// Luật xoá: KHÔNG xoá thứ đã có click. Khoá ngoại đang để CASCADE/SET NULL nên một cú xoá chiến
// dịch sẽ kéo theo toàn bộ lịch sử click của nó — mà click là bảng duy nhất mất là mất vĩnh viễn
// (đơn về sau 30 ngày không còn đường biết của ai). Có click rồi thì TẮT, đừng xoá.

import { revalidatePath } from 'next/cache';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { checkOffer, checkPublisher } from '@/lib/network/link';

type Res = { ok: boolean; error?: string };
const OK: Res = { ok: true };

async function admin(): Promise<{ id: number } | null> {
  const me = await getCurrentUser();
  return me && me.role === 'admin' ? { id: me.id } : null;
}

function bump() {
  revalidatePath('/network');
  revalidatePath('/pub');
}

export interface OfferInput {
  id?: number;
  slug: string; name: string; network: string;
  advertiser?: string; category?: string; upstreamUrl: string;
  upstreamRate?: string; publisherRate?: string; cookieDays?: number | null; terms?: string;
  active: boolean;
}

export async function saveOffer(input: OfferInput): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };

  const bad = checkOffer(input);
  if (bad) return { ok: false, error: bad };
  const slug = input.slug.trim().toLowerCase();

  const v = {
    slug, name: input.name.trim(), network: input.network,
    advertiser: input.advertiser?.trim() || null, category: input.category?.trim() || null,
    upstreamUrl: input.upstreamUrl.trim(),
    upstreamRate: input.upstreamRate?.trim() || null,
    publisherRate: input.publisherRate?.trim() || null,
    cookieDays: input.cookieDays ?? null,
    terms: input.terms?.trim() || null,
    active: input.active,
  };

  try {
    if (input.id) {
      await db.execute(sql`
        UPDATE net_offers SET slug=${v.slug}, name=${v.name}, network=${v.network},
          advertiser=${v.advertiser}, category=${v.category}, upstream_url=${v.upstreamUrl},
          upstream_rate=${v.upstreamRate}, publisher_rate=${v.publisherRate},
          cookie_days=${v.cookieDays}, terms=${v.terms}, active=${v.active}
        WHERE id=${input.id}`);
    } else {
      await db.execute(sql`
        INSERT INTO net_offers (slug, name, network, advertiser, category, upstream_url, upstream_rate, publisher_rate, cookie_days, terms, active)
        VALUES (${v.slug}, ${v.name}, ${v.network}, ${v.advertiser}, ${v.category}, ${v.upstreamUrl},
                ${v.upstreamRate}, ${v.publisherRate}, ${v.cookieDays}, ${v.terms}, ${v.active})`);
    }
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes('net_offers_slug') ? `Slug "${slug}" đã có chiến dịch khác dùng` : m };
  }
  bump();
  return OK;
}

/** Bật/tắt chiến dịch. Tắt = link ngừng chạy NGAY (route /c/ kiểm o.active), lịch sử giữ nguyên. */
export async function toggleOffer(id: number, active: boolean): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  await db.execute(sql`UPDATE net_offers SET active=${active} WHERE id=${id}`);
  bump();
  return OK;
}

export async function deleteOffer(id: number): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM net_clicks WHERE offer_id=${id}`);
  const n = Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0);
  // Khoá ngoại là CASCADE → xoá chiến dịch là xoá luôn click của nó, tức là xoá luôn đường quy
  // công cho những đơn CHƯA về. Tắt thì link ngừng ngay mà số liệu còn nguyên.
  if (n > 0) return { ok: false, error: `Chiến dịch này đã có ${n} click — tắt đi, đừng xoá (xoá là mất luôn lịch sử quy công)` };
  await db.execute(sql`DELETE FROM net_offers WHERE id=${id}`);
  bump();
  return OK;
}

export interface PublisherInput {
  id?: number;
  slug: string; name: string; kind: string; status: string; note?: string;
  userId?: number | null;
}

export async function savePublisher(input: PublisherInput): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  const bad = checkPublisher(input);
  if (bad) return { ok: false, error: bad };
  const slug = input.slug.trim().toLowerCase();
  const uid = input.userId ?? null;
  try {
    // Một user chỉ thuộc một publisher — gỡ chỗ cũ trước, nếu không publisherForUser() vớ phải
    // hàng đầu tiên nó gặp và người ta thấy số của người khác.
    if (uid) await db.execute(sql`UPDATE net_publishers SET user_id=NULL WHERE user_id=${uid} AND id IS DISTINCT FROM ${input.id ?? null}`);
    if (input.id) {
      await db.execute(sql`
        UPDATE net_publishers SET slug=${slug}, name=${input.name.trim()}, kind=${input.kind},
          status=${input.status}, note=${input.note?.trim() || null}, user_id=${uid}
        WHERE id=${input.id}`);
    } else {
      await db.execute(sql`
        INSERT INTO net_publishers (slug, name, kind, status, note, user_id)
        VALUES (${slug}, ${input.name.trim()}, ${input.kind}, ${input.status}, ${input.note?.trim() || null}, ${uid})`);
    }
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes('net_publishers_slug') ? `Slug "${slug}" đã có publisher khác dùng` : m };
  }
  bump();
  return OK;
}

export async function deletePublisher(id: number): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM net_clicks WHERE publisher_id=${id}`);
  const n = Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0);
  // publisher_id là SET NULL → xoá người thì click của họ thành vô chủ, và đơn về sau đó không
  // quy được cho ai. Chuyển trạng thái sang 'banned'/'paused' thay vì xoá.
  if (n > 0) return { ok: false, error: `Publisher này đã có ${n} click — chuyển trạng thái sang paused/banned, đừng xoá` };
  await db.execute(sql`DELETE FROM net_publishers WHERE id=${id}`);
  bump();
  return OK;
}

export async function decideRegistration(id: number, approve: boolean): Promise<Res> {
  const me = await admin();
  // Duyệt = mở đường cho traffic người khác chạy qua tài khoản upstream của mình. Chỉ admin.
  if (!me) return { ok: false, error: 'Chỉ admin được duyệt' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  await db.execute(sql`
    UPDATE net_publisher_offers
    SET status=${approve ? 'approved' : 'rejected'}, decided_at=now(), decided_by=${me.id}
    WHERE id=${id}`);
  bump();
  return OK;
}

/** Giá/tỉ lệ RIÊNG cho một publisher trên một chiến dịch. Bỏ trống = theo mức chung của chiến dịch. */
export async function setRegistrationRate(id: number, rate: string): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  await db.execute(sql`UPDATE net_publisher_offers SET publisher_rate=${rate.trim() || null} WHERE id=${id}`);
  bump();
  return OK;
}

/** Admin gán thẳng một chiến dịch cho publisher (không cần họ xin) — đội in-house dùng đường này. */
export async function grantOffer(publisherId: number, offerId: number): Promise<Res> {
  const me = await admin();
  if (!me) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  await db.execute(sql`
    INSERT INTO net_publisher_offers (publisher_id, offer_id, status, decided_at, decided_by)
    VALUES (${publisherId}, ${offerId}, 'approved', now(), ${me.id})
    ON CONFLICT (publisher_id, offer_id) DO UPDATE
      SET status='approved', decided_at=now(), decided_by=${me.id}`);
  bump();
  return OK;
}

export async function requestOffer(offerId: number): Promise<Res> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'Chưa đăng nhập' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  const r = await db.execute(sql`SELECT id FROM net_publishers WHERE user_id=${me.id} AND status='active' LIMIT 1`);
  const pub = (r as unknown as Array<{ id: number }>)[0];
  if (!pub) return { ok: false, error: 'Tài khoản này chưa gắn với publisher nào' };
  // Xin lại chiến dịch đã bị từ chối thì cho (đổi kênh, sửa cách chạy). Đã duyệt rồi thì GIỮ —
  // một cú bấm nhầm không được hạ nó về pending và cắt link đang chạy.
  await db.execute(sql`
    INSERT INTO net_publisher_offers (publisher_id, offer_id, status)
    VALUES (${pub.id}, ${offerId}, 'pending')
    ON CONFLICT (publisher_id, offer_id) DO UPDATE
      SET status='pending', requested_at=now(), decided_at=NULL
      WHERE net_publisher_offers.status='rejected'`);
  bump();
  return OK;
}

export async function linkPublisherUser(publisherId: number, userId: number | null): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin được gán' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  if (userId) await db.execute(sql`UPDATE net_publishers SET user_id=NULL WHERE user_id=${userId}`);
  await db.execute(sql`UPDATE net_publishers SET user_id=${userId} WHERE id=${publisherId}`);
  bump();
  return OK;
}
