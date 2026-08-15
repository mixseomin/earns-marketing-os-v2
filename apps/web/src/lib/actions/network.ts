'use server';

// Hành động của nền tảng network. Duyệt/từ chối đăng ký chiến dịch, và publisher xin chạy.

import { revalidatePath } from 'next/cache';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function decideRegistration(id: number, approve: boolean): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  // Duyệt đăng ký = mở đường cho traffic của người khác chạy qua tài khoản upstream của mình.
  // Chỉ admin, không phải ai đăng nhập được cũng duyệt.
  if (!me || me.role !== 'admin') return { ok: false, error: 'Chỉ admin được duyệt' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  await db.execute(sql`
    UPDATE net_publisher_offers
    SET status = ${approve ? 'approved' : 'rejected'}, decided_at = now(), decided_by = ${me.id}
    WHERE id = ${id}`);
  revalidatePath('/network');
  return { ok: true };
}

export async function requestOffer(offerId: number): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'Chưa đăng nhập' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  const r = await db.execute(sql`SELECT id FROM net_publishers WHERE user_id = ${me.id} AND status = 'active' LIMIT 1`);
  const pub = (r as unknown as Array<{ id: number }>)[0];
  if (!pub) return { ok: false, error: 'Tài khoản này chưa gắn với publisher nào' };
  // Xin lại chiến dịch đã bị từ chối thì cho xin lại (đổi kênh, sửa cách chạy) — nhưng đã duyệt
  // rồi thì giữ nguyên, đừng để một cú bấm nhầm hạ nó về pending và cắt link đang chạy.
  await db.execute(sql`
    INSERT INTO net_publisher_offers (publisher_id, offer_id, status)
    VALUES (${pub.id}, ${offerId}, 'pending')
    ON CONFLICT (publisher_id, offer_id) DO UPDATE
      SET status = 'pending', requested_at = now(), decided_at = NULL
      WHERE net_publisher_offers.status = 'rejected'`);
  revalidatePath('/pub');
  return { ok: true };
}

/** Gán user MOS2 cho publisher → user đó đăng nhập vào pub.on.tc thấy đúng số của mình.
 *  Đặt ở đây chứ không /team: đây là quan hệ của network, không phải quyền trong MOS2. */
export async function linkPublisherUser(publisherId: number, userId: number | null): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'Chỉ admin được gán' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  // Một user chỉ thuộc MỘT publisher: gán chỗ này thì gỡ chỗ kia trước, nếu không
  // publisherForUser() lấy phải hàng đầu tiên nó gặp và người ta thấy số của người khác.
  if (userId) await db.execute(sql`UPDATE net_publishers SET user_id = NULL WHERE user_id = ${userId}`);
  await db.execute(sql`UPDATE net_publishers SET user_id = ${userId} WHERE id = ${publisherId}`);
  revalidatePath('/network');
  return { ok: true };
}
