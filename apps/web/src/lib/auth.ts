// Email + password auth + session management. Server-side only.
// Cookie 'mos2-session' = random 32-byte hex token, validated against DB.

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const SESSION_COOKIE = 'mos2-session';
// Share the session across all *.on.tc subdomains (course.on.tc, user.on.tc …) for SSO.
// Host-only in dev (localhost). Widening the domain logs existing prod sessions out once.
const SESSION_COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.on.tc' : undefined;
const SESSION_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 10;
// Bootstrap: if no admin has password set yet, allow setting initial password
// via /login bootstrap form (gated by MOS2_AGENT_TOKEN env var).
const BOOTSTRAP_TOKEN = process.env.MOS2_AGENT_TOKEN ?? '';

function genToken(): string {
  return randomBytes(32).toString('hex');
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  displayName: string;
  role: 'admin' | 'operator' | 'viewer';
  specialty: string;
  active: boolean;
}

// ── Password login ──────────────────────────────────────────────────
export async function loginWithPassword(email: string, password: string): Promise<{ ok: boolean; userId?: number; error?: string }> {
  if (!email?.trim() || !password) return { ok: false, error: 'Email + password bắt buộc' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  const rows = await db.execute(sql`
    SELECT id, password_hash FROM users
    WHERE tenant_id = ${TENANT} AND email = ${email.trim().toLowerCase()}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<{ id: number; password_hash: string | null }>)[0];
  // Generic message — don't leak which emails exist
  if (!r || !r.password_hash) return { ok: false, error: 'Email hoặc password sai' };
  const ok = await bcrypt.compare(password, r.password_hash);
  if (!ok) return { ok: false, error: 'Email hoặc password sai' };
  await createSession(Number(r.id));
  await db.execute(sql`UPDATE users SET last_login_at = NOW() WHERE id = ${r.id}`);
  return { ok: true, userId: Number(r.id) };
}

// ── SSO .on.tc: một lần đăng nhập Google cho cả nhà ─────────────────
// Cổng Google đã chạy ở stm.on.tc (/_sso, nginx auth_request) đặt cookie ký HMAC trên
// TOÀN miền .on.tc. MOS2 chỉ việc đọc cookie đó, kiểm chữ ký, rồi cấp PHIÊN MOS2 bình
// thường — mọi guard/role/impersonate phía sau không phải biết Google là gì.
// Vì sao không gắn thẳng nút Google vào mos2.on.tc: origin JS phải đăng ký trong GCP
// console, mà Google không mở API cho việc đó (chỉ bấm tay trong console). Cổng chung
// vừa né được chỗ đó vừa đúng nghĩa SSO: đăng nhập một lần dùng cho mọi host .on.tc.
// app_settings key='sso_on_tc' = { cookie, gate, verify, map }. MOS2 KHÔNG giữ khoá ký của cổng:
// nó gửi nguyên cookie sang cửa /_sso/whoami.php của cổng và nhận về email — khoá ở lại box1,
// một chỗ duy nhất. map = { "google@gmail.com": "user@mos2" } khi hai email khác nhau.
// ponytail: ánh xạ để trong config, chưa cần cột users.google_email — thêm cột khi nhiều người cần map.
type SsoCfg = {
  cookie: string;                                            // tên cookie cổng đặt trên .on.tc
  gate: string;                                              // trang đăng nhập của cổng
  verify: { host: string; ip?: string; path: string };       // cửa hỏi "cookie này của ai"
  map: Record<string, string>;                               // email Google → email tài khoản MOS2
};
let ssoCache: { at: number; cfg: SsoCfg | null } = { at: 0, cfg: null };

/** Cấu hình cổng nằm ở app_settings key='sso_on_tc' (cùng chỗ với config khác của MOS2). Không có
 *  khoá ký nào ở đây: MOS2 KHÔNG tự kiểm chữ ký, nó hỏi cổng — khoá ở lại một chỗ duy nhất. */
async function ssoCfg(): Promise<SsoCfg | null> {
  if (Date.now() - ssoCache.at < 300_000) return ssoCache.cfg;
  const db = getDb();
  let cfg: SsoCfg | null = null;
  if (db) {
    const r = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'sso_on_tc' LIMIT 1`);
    const v = (r as unknown as Array<{ value: Partial<SsoCfg> }>)[0]?.value;
    if (v?.cookie && v?.gate && v?.verify?.host && v?.verify?.path) {
      cfg = { cookie: v.cookie, gate: v.gate, verify: v.verify, map: v.map ?? {} };
    }
  }
  ssoCache = { at: Date.now(), cfg };
  return cfg;
}

function ssoAlias(cfg: SsoCfg, email: string): string {
  for (const [g, u] of Object.entries(cfg.map)) {
    if (g.trim().toLowerCase() === email) return String(u).trim().toLowerCase();
  }
  return email;   // không khai báo → thử đúng email đó trong bảng users
}

/** Lấy giá trị cookie cổng trong header Cookie. Tách riêng để bài kiểm chạy được (scripts/check-sso-cookie.mjs). */
export function docCookieCong(cookieHeader: string, ten: string): string | null {
  const m = cookieHeader.match(new RegExp('(?:^|;\\s*)' + ten.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]+)'));
  return m?.[1] ?? null;
}

/** Đích tuyệt đối cho redirect của route handler. KHÔNG dựng từ req.url: sau nginx, Next lấy
 *  host nội bộ nên Location ra "https://localhost:3821/..." và trình duyệt đi vào hư không. */
export function duongVe(dest: string, reqUrl: string): string {
  if (/^https?:\/\//i.test(dest)) return dest;
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(reqUrl).origin;
  return new URL(dest, base.replace(/\/$/, '') + '/').toString();
}

/** Có cookie cổng trong request không (không hỏi cổng, không chạm DB) — trang /login dùng để
 *  quyết định có đẩy sang /api/auth/on-tc hay không. */
export async function coCookieCong(): Promise<boolean> {
  const cfg = await ssoCfg();
  if (!cfg) return false;
  return docCookieCong((await headers()).get('cookie') || '', cfg.cookie) !== null;
}

/** URL cổng Google, kèm đường quay lại. Rỗng = chưa cấu hình → trang login chỉ có email+mật khẩu. */
export async function ssoGateUrl(next: string): Promise<string> {
  const cfg = await ssoCfg();
  if (!cfg) return '';
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://mos2.on.tc').replace(/\/$/, '');
  // Đăng nhập xong cổng trả người dùng về ĐÚNG cửa đổi phiên, không phải về /login (đỡ một nhịp).
  const back = `${base}/api/auth/on-tc?next=${encodeURIComponent(next)}`;
  return `${cfg.gate}${cfg.gate.includes('?') ? '&' : '?'}next=${encodeURIComponent(back)}`;
}

/** Hỏi cổng: cookie này của ai. Đi THẲNG vào origin box1 (verify.ip) chứ không qua Cloudflare —
 *  WAF của zone chặn request không phải trình duyệt (đo được 403). TLS vẫn kiểm theo tên host. */
async function hoiCong(cfg: SsoCfg, cookieValue: string): Promise<string | null> {
  const { request } = await import('node:https');
  return new Promise((resolve) => {
    const req = request({
      host: cfg.verify.ip || cfg.verify.host,
      servername: cfg.verify.host,
      port: 443,
      path: cfg.verify.path,
      method: 'GET',
      timeout: 5000,
      headers: { Host: cfg.verify.host, Cookie: `${cfg.cookie}=${cookieValue}`, 'User-Agent': 'mos2-sso' },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => { body += c; if (body.length > 4096) req.destroy(); });
      res.on('end', () => resolve(docTraLoiCong(body)));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/** Đọc câu trả lời của cổng ({"email": "…"} hoặc {"email": null}). Tách riêng để bài kiểm chạy được. */
export function docTraLoiCong(body: string): string | null {
  try {
    const j = JSON.parse(body) as { email?: unknown };
    const e = typeof j.email === 'string' ? j.email.trim().toLowerCase() : '';
    return e.includes('@') ? e : null;
  } catch {
    return null;
  }
}

/** Có cookie SSO hợp lệ + email ứng với một tài khoản MOS2 đang hoạt động → cấp phiên luôn.
 *  Gọi ở /login: mọi trang chưa đăng nhập đều rơi về đó, nên một chỗ là đủ. */
export async function loginWithOnTcSso(): Promise<{ ok: boolean; error?: string }> {
  const cfg = await ssoCfg();
  if (!cfg) return { ok: false };
  const raw = (await headers()).get('cookie') || '';
  const val = docCookieCong(raw, cfg.cookie);
  if (!val) return { ok: false };
  const email = await hoiCong(cfg, val);
  if (!email) return { ok: false };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  const rows = await db.execute(sql`
    SELECT u.id, COALESCE(m.active, TRUE) AS active
    FROM users u LEFT JOIN members m ON m.user_id = u.id AND m.project_id IS NULL
    WHERE u.tenant_id = ${TENANT} AND lower(u.email) = ${ssoAlias(cfg, email)}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<{ id: number; active: boolean }>)[0];
  if (!r) return { ok: false, error: `${email} chưa có tài khoản trên MOS2` };
  if (!r.active) return { ok: false, error: 'Tài khoản đã bị khoá' };
  await createSession(Number(r.id));
  await db.execute(sql`UPDATE users SET last_login_at = NOW() WHERE id = ${r.id}`);
  return { ok: true };
}

// ── Set / reset password (admin sets for member, or self) ──────────
export async function setUserPassword(userId: number, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 8) return { ok: false, error: 'Password tối thiểu 8 ký tự' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.execute(sql`
    UPDATE users SET password_hash = ${hash}, password_set_at = NOW(), updated_at = NOW()
    WHERE id = ${userId} AND tenant_id = ${TENANT}
  `);
  return { ok: true };
}

// ── Bootstrap: set initial admin password when no admin has one yet ──
export async function bootstrapAdminPassword(suppliedToken: string, password: string): Promise<{ ok: boolean; userId?: number; error?: string }> {
  if (!BOOTSTRAP_TOKEN) return { ok: false, error: 'Bootstrap disabled (MOS2_AGENT_TOKEN env not set)' };
  if (suppliedToken !== BOOTSTRAP_TOKEN) return { ok: false, error: 'Bootstrap token mismatch' };
  if (!password || password.length < 8) return { ok: false, error: 'Password tối thiểu 8 ký tự' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  // Verify no admin already has password — bootstrap allowed only on fresh install.
  const adminRows = await db.execute(sql`
    SELECT u.id, u.password_hash FROM users u
    JOIN members m ON m.user_id = u.id AND m.project_id IS NULL AND m.role = 'admin'
    WHERE u.tenant_id = ${TENANT}
    ORDER BY u.id ASC LIMIT 1
  `);
  const r = (adminRows as unknown as Array<{ id: number; password_hash: string | null }>)[0];
  if (!r) return { ok: false, error: 'Chưa có admin user nào trong DB. Tạo trước (qua migration / script).' };
  if (r.password_hash) return { ok: false, error: 'Admin đã có password — dùng /login form bình thường, hoặc reset via /team' };
  const setRes = await setUserPassword(Number(r.id), password);
  if (!setRes.ok) return { ok: false, error: setRes.error };
  await createSession(Number(r.id));
  await db.execute(sql`UPDATE users SET last_login_at = NOW() WHERE id = ${r.id}`);
  return { ok: true, userId: Number(r.id) };
}

// ── Internal: create session row + set cookie ──────────────────────
async function createSession(userId: number): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('DB not available');
  const token = genToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = h.get('user-agent') ?? null;
  await db.execute(sql`
    INSERT INTO auth_sessions (session_token, user_id, expires_at, ip, user_agent)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()}::timestamptz, ${ip}, ${ua})
  `);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    path: '/',
    domain: SESSION_COOKIE_DOMAIN,
    maxAge: SESSION_TTL_DAYS * 86400,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

// ── Get current authenticated user ─────────────────────────────────
export async function getCurrentUser(): Promise<AuthUser | null> {
  // Widening the cookie domain (host-only mos2.on.tc → shared .on.tc) can leave the browser holding
  // TWO `mos2-session` cookies. It may send the stale one first, and cookies().get() would pick that
  // → phantom logout: getCurrentUser returns null, admin pages bounce to /, home still renders → user
  // trapped on / (incident 2026-08-08). So read EVERY mos2-session value from the raw Cookie header
  // and use the first that resolves to a LIVE session (validity enforced in SQL).
  const rawCookie = (await headers()).get('cookie') || '';
  const tokens = Array.from(rawCookie.matchAll(/(?:^|;\s*)mos2-session=([^;]+)/g)).map((m) => (m[1] ?? '').trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  const db = getDb();
  if (!db) return null;
  for (const token of tokens) {
    const rows = await db.execute(sql`
      SELECT s.user_id, u.email, u.name,
             m.display_name, m.role, m.specialty, m.active
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN members m ON m.user_id = s.user_id AND m.project_id IS NULL
      WHERE s.session_token = ${token} AND s.revoked_at IS NULL AND s.expires_at > NOW()
      LIMIT 1
    `);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!r) continue;
    // Touch last_seen_at (best-effort)
    db.execute(sql`UPDATE auth_sessions SET last_seen_at = NOW() WHERE session_token = ${token}`).catch(() => {});
    return {
      id: Number(r.user_id),
      email: String(r.email),
      name: String(r.name ?? ''),
      displayName: String(r.display_name ?? r.name ?? ''),
      role: (String(r.role ?? 'viewer') as AuthUser['role']),
      specialty: String(r.specialty ?? 'other'),
      active: Boolean(r.active),
    };
  }
  return null;
}

export async function getCurrentUserId(): Promise<number | null> {
  const u = await getCurrentUser();
  return u?.id ?? null;
}

// When admin is impersonating via mos2-view-as cookie, returns the target user.
// Use this for data-fetching / rendering. Use getCurrentUser() for auth guards.
export async function getEffectiveUser(): Promise<AuthUser | null> {
  const real = await getCurrentUser();
  if (!real || real.role !== 'admin') return real;
  const cookieStore = await cookies();
  const viewAsId = cookieStore.get('mos2-view-as')?.value;
  if (!viewAsId) return real;
  const db = getDb();
  if (!db) return real;
  const rows = await db.execute(sql`
    SELECT u.id, u.email, u.name, m.display_name, m.role, m.specialty, m.active
    FROM users u
    LEFT JOIN members m ON m.user_id = u.id AND m.project_id IS NULL AND m.tenant_id = ${TENANT}
    WHERE u.id = ${Number(viewAsId)} AND u.tenant_id = ${TENANT}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return real;
  return {
    id: Number(r.id),
    email: String(r.email),
    name: String(r.name ?? ''),
    displayName: String(r.display_name ?? r.name ?? ''),
    role: String(r.role ?? 'viewer') as AuthUser['role'],
    specialty: String(r.specialty ?? 'other'),
    active: Boolean(r.active),
  };
}

// ── Logout (revoke current session) ──
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    if (db) await db.execute(sql`UPDATE auth_sessions SET revoked_at = NOW() WHERE session_token = ${token}`);
  }
  cookieStore.set(SESSION_COOKIE, '', { path: '/', domain: SESSION_COOKIE_DOMAIN, maxAge: 0 });
}

// ── Role guards ────────────────────────────────────────────────────
export async function requireAuth(): Promise<AuthUser> {
  const u = await getCurrentUser();
  if (!u) redirect('/login');   // page/server-component guard — redirect, not a 500
  return u;
}

export async function requireRole(roles: Array<AuthUser['role']>): Promise<AuthUser> {
  const u = await requireAuth();
  if (!roles.includes(u.role)) throw new Error(`FORBIDDEN: needs role ${roles.join('|')}, has ${u.role}`);
  return u;
}

// ── Bootstrap status check (for /login UI) ──────────────────────────
export async function needsBootstrap(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const r = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM users u
    JOIN members m ON m.user_id = u.id AND m.project_id IS NULL AND m.role = 'admin'
    WHERE u.tenant_id = ${TENANT} AND u.password_hash IS NOT NULL
  `);
  const n = (r as unknown as Array<{ n: number }>)[0]?.n ?? 0;
  return n === 0;
}

// ── Tự đổi mật khẩu ─────────────────────────────────────────────────────────
/** Người dùng tự đổi mật khẩu CỦA CHÍNH MÌNH. Bắt buộc nhập mật khẩu hiện tại: không có bước đó
 *  thì một phiên bị bỏ quên trên máy lạ đủ để chiếm luôn tài khoản. Chưa từng đặt mật khẩu (user
 *  admin vừa tạo) thì bỏ qua bước kiểm — đó là lần đặt đầu tiên, không phải đổi. */
export async function changeOwnPassword(userId: number, current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  if (!next || next.length < 8) return { ok: false, error: 'Mật khẩu mới tối thiểu 8 ký tự' };
  if (next === current) return { ok: false, error: 'Mật khẩu mới trùng mật khẩu cũ' };
  const rows = await db.execute(sql`
    SELECT password_hash FROM users WHERE id = ${userId} AND tenant_id = ${TENANT} LIMIT 1`);
  const r = (rows as unknown as Array<{ password_hash: string | null }>)[0];
  if (!r) return { ok: false, error: 'Không tìm thấy tài khoản' };
  if (r.password_hash && !(await bcrypt.compare(current, r.password_hash))) {
    return { ok: false, error: 'Mật khẩu hiện tại không đúng' };
  }
  return setUserPassword(userId, next);
}
