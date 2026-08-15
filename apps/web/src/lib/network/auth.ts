// Đăng nhập của PUBLISHER — hệ danh tính riêng, tách hẳn khỏi user MOS2.
//
// Điểm sống còn: cookie ở đây KHÔNG đặt `domain`. `mos2-session` đặt `.on.tc` để SSO nội bộ, nên
// nếu publisher dùng chung hệ đó thì đăng nhập ở pub.on.tc là cầm luôn phiên hợp lệ trên
// mos2.on.tc. Cookie host-only thì trình duyệt không bao giờ gửi nó sang tên miền khác, và
// `mos2-session` cũng không mở được /pub vì chỗ này chỉ đọc `pub-session`.

import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '@mos2/db';

const COOKIE = 'pub-session';
const TTL_DAYS = 30;
const ROUNDS = 10;
/** Link đặt mật khẩu sống 7 ngày. Dài hơn thì một link rò rỉ trong hộp thư cũ vẫn mở được tài khoản. */
const SETUP_TTL_HOURS = 24 * 7;

export interface PubUser { id: number; slug: string; name: string; email: string | null }

const token = () => randomBytes(32).toString('hex');

export async function pubLogin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  if (!email?.trim() || !password) return { ok: false, error: 'Nhập email và mật khẩu' };
  const rows = await db.execute(sql`
    SELECT id, password_hash, status FROM net_publishers
    WHERE lower(email) = lower(${email.trim()}) LIMIT 1`);
  const r = (rows as unknown as Array<{ id: number; password_hash: string | null; status: string }>)[0];
  // Câu báo lỗi CHUNG cho mọi ca sai: nói "email không tồn tại" là tặng người dò một cách đếm
  // publisher của mình.
  const bad = { ok: false as const, error: 'Email hoặc mật khẩu sai' };
  if (!r || !r.password_hash) return bad;
  if (r.status !== 'active') return { ok: false, error: 'Tài khoản đang tạm dừng' };
  if (!(await bcrypt.compare(password, r.password_hash))) return bad;
  await createSession(Number(r.id));
  return { ok: true };
}

async function createSession(publisherId: number) {
  const db = getDb();
  if (!db) return;
  const t = token();
  const exp = new Date(Date.now() + TTL_DAYS * 86400_000);
  await db.execute(sql`
    INSERT INTO net_sessions (token, publisher_id, expires_at) VALUES (${t}, ${publisherId}, ${exp.toISOString()})`);
  const jar = await cookies();
  jar.set(COOKIE, t, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: exp,
    // KHÔNG `domain`. Đặt vào là cookie đi sang mọi *.on.tc và lỗ vừa bịt mở lại.
  });
}

export async function currentPublisher(): Promise<PubUser | null> {
  const db = getDb();
  if (!db) return null;
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const rows = await db.execute(sql`
    SELECT p.id, p.slug, p.name, p.email
    FROM net_sessions s JOIN net_publishers p ON p.id = s.publisher_id
    WHERE s.token = ${t} AND s.revoked_at IS NULL AND s.expires_at > now() AND p.status = 'active'
    LIMIT 1`);
  const r = (rows as unknown as Array<{ id: number; slug: string; name: string; email: string | null }>)[0];
  if (!r) return null;
  db.execute(sql`UPDATE net_sessions SET last_seen_at = now() WHERE token = ${t}`).catch(() => {});
  return { id: Number(r.id), slug: r.slug, name: r.name, email: r.email };
}

export async function pubLogout(): Promise<void> {
  const db = getDb();
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t && db) await db.execute(sql`UPDATE net_sessions SET revoked_at = now() WHERE token = ${t}`);
  jar.delete(COOKIE);
}

/** Admin phát link một lần; publisher tự gõ mật khẩu ở đó. Admin không bao giờ biết mật khẩu. */
export async function issueSetupToken(publisherId: number): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const t = token();
  const exp = new Date(Date.now() + SETUP_TTL_HOURS * 3600_000);
  const r = await db.execute(sql`
    UPDATE net_publishers SET setup_token = ${t}, setup_expires_at = ${exp.toISOString()}
    WHERE id = ${publisherId} AND email IS NOT NULL RETURNING id`);
  return (r as unknown as unknown[]).length ? t : null;
}

export async function setPasswordByToken(setup: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  if (!password || password.length < 8) return { ok: false, error: 'Mật khẩu tối thiểu 8 ký tự' };
  const rows = await db.execute(sql`
    SELECT id FROM net_publishers
    WHERE setup_token = ${setup} AND setup_expires_at > now() LIMIT 1`);
  const r = (rows as unknown as Array<{ id: number }>)[0];
  if (!r) return { ok: false, error: 'Link đã hết hạn hoặc đã dùng rồi' };
  const hash = await bcrypt.hash(password, ROUNDS);
  // Xoá token NGAY trong cùng câu lệnh: dùng một lần là hết, link nằm lại trong hộp thư không mở
  // được nữa.
  await db.execute(sql`
    UPDATE net_publishers
    SET password_hash = ${hash}, password_set_at = now(), setup_token = NULL, setup_expires_at = NULL
    WHERE id = ${r.id}`);
  await createSession(Number(r.id));
  return { ok: true };
}

export async function pubChangePassword(publisherId: number, current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  if (!next || next.length < 8) return { ok: false, error: 'Mật khẩu mới tối thiểu 8 ký tự' };
  if (next === current) return { ok: false, error: 'Mật khẩu mới trùng mật khẩu cũ' };
  const rows = await db.execute(sql`SELECT password_hash FROM net_publishers WHERE id = ${publisherId} LIMIT 1`);
  const r = (rows as unknown as Array<{ password_hash: string | null }>)[0];
  if (!r?.password_hash) return { ok: false, error: 'Tài khoản chưa đặt mật khẩu' };
  if (!(await bcrypt.compare(current, r.password_hash))) return { ok: false, error: 'Mật khẩu hiện tại không đúng' };
  const hash = await bcrypt.hash(next, ROUNDS);
  await db.execute(sql`UPDATE net_publishers SET password_hash = ${hash}, password_set_at = now() WHERE id = ${publisherId}`);
  // Đá mọi phiên KHÁC ra: đổi mật khẩu vì nghi bị lộ mà phiên cũ vẫn sống thì đổi để làm gì.
  await db.execute(sql`UPDATE net_sessions SET revoked_at = now() WHERE publisher_id = ${publisherId} AND revoked_at IS NULL`);
  await createSession(publisherId);
  return { ok: true };
}
