// Email + password auth + session management. Server-side only.
// Cookie 'mos2-session' = random 32-byte hex token, validated against DB.

import { cookies, headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const SESSION_COOKIE = 'mos2-session';
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
    maxAge: SESSION_TTL_DAYS * 86400,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

// ── Get current authenticated user ─────────────────────────────────
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  if (!db) return null;
  const rows = await db.execute(sql`
    SELECT s.user_id, s.expires_at, s.revoked_at, u.email, u.name,
           m.display_name, m.role, m.specialty, m.active
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN members m ON m.user_id = s.user_id AND m.project_id IS NULL
    WHERE s.session_token = ${token} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return null;
  if (r.revoked_at) return null;
  if (new Date(String(r.expires_at)).getTime() < Date.now()) return null;
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

export async function getCurrentUserId(): Promise<number | null> {
  const u = await getCurrentUser();
  return u?.id ?? null;
}

// ── Logout (revoke current session) ──
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    if (db) await db.execute(sql`UPDATE auth_sessions SET revoked_at = NOW() WHERE session_token = ${token}`);
  }
  cookieStore.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
}

// ── Role guards ────────────────────────────────────────────────────
export async function requireAuth(): Promise<AuthUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error('UNAUTHENTICATED');
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
