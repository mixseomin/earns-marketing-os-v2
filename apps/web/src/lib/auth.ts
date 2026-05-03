// Magic link auth + session management. Server-side only.
// Cookie 'mos2-session' = random 32-byte hex token, validated against DB.

import { cookies, headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const SESSION_COOKIE = 'mos2-session';
const SESSION_TTL_DAYS = 30;
const MAGIC_TTL_HOURS = 24;
// Bootstrap: when no users have any sessions yet (fresh install), allow first
// admin to log in via /login?bootstrap=<MOS2_AGENT_TOKEN>. Disabled if env unset.
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

// ── Magic link generation (admin clicks "Generate login link" for member) ──
export async function createMagicLink(targetUserId: number, createdBy?: number): Promise<{ ok: boolean; url?: string; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  const token = genToken();
  const expiresAt = new Date(Date.now() + MAGIC_TTL_HOURS * 3600_000);
  await db.execute(sql`
    INSERT INTO auth_tokens (token, user_id, purpose, expires_at, created_by_user_id)
    VALUES (${token}, ${targetUserId}, 'login', ${expiresAt.toISOString()}::timestamptz, ${createdBy ?? null})
  `);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mos2.on.tc';
  const url = `${baseUrl}/auth/verify?token=${token}`;
  return { ok: true, url };
}

// ── Verify magic link → create session → set cookie ──
export async function verifyMagicLink(token: string): Promise<{ ok: boolean; userId?: number; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };

  // Look up token (must exist, not used, not expired)
  const rows = await db.execute(sql`
    SELECT id, user_id, expires_at, used_at FROM auth_tokens
    WHERE token = ${token} LIMIT 1
  `);
  const r = (rows as unknown as Array<{ id: number; user_id: number; expires_at: string; used_at: string | null }>)[0];
  if (!r) return { ok: false, error: 'Token không hợp lệ' };
  if (r.used_at) return { ok: false, error: 'Token đã dùng rồi — yêu cầu link mới' };
  if (new Date(r.expires_at).getTime() < Date.now()) return { ok: false, error: 'Token đã hết hạn — yêu cầu link mới' };

  // Mark token used
  await db.execute(sql`UPDATE auth_tokens SET used_at = NOW() WHERE id = ${r.id}`);

  // Create session
  await createSession(Number(r.user_id));
  // Update last login
  await db.execute(sql`UPDATE users SET last_login_at = NOW() WHERE id = ${r.user_id}`);
  return { ok: true, userId: Number(r.user_id) };
}

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

// ── Bootstrap: first admin login when no sessions exist ──
export async function bootstrapAdmin(suppliedToken: string): Promise<{ ok: boolean; userId?: number; error?: string }> {
  if (!BOOTSTRAP_TOKEN) return { ok: false, error: 'Bootstrap disabled (MOS2_AGENT_TOKEN not set)' };
  if (suppliedToken !== BOOTSTRAP_TOKEN) return { ok: false, error: 'Bootstrap token mismatch' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  // Find first admin
  const rows = await db.execute(sql`
    SELECT u.id FROM users u
    JOIN members m ON m.user_id = u.id AND m.project_id IS NULL AND m.role = 'admin'
    WHERE u.tenant_id = ${TENANT}
    ORDER BY u.id ASC LIMIT 1
  `);
  const r = (rows as unknown as Array<{ id: number }>)[0];
  if (!r) return { ok: false, error: 'Chưa có admin user nào trong DB' };
  await createSession(Number(r.id));
  await db.execute(sql`UPDATE users SET last_login_at = NOW() WHERE id = ${r.id}`);
  return { ok: true, userId: Number(r.id) };
}

// ── Get current authenticated user (replaces old cookie hack) ──
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
  // Touch last_seen_at (best-effort, no await needed)
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

// ── Role guards (for server actions / pages) ──
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

// ── Pending magic links (for /team admin view) ──
export async function listPendingMagicLinks(): Promise<Array<{ tokenId: number; userId: number; userEmail: string; userName: string; url: string; expiresAt: string; createdAt: string }>> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT t.id, t.token, t.user_id, t.expires_at, t.created_at, u.email, u.name
    FROM auth_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.used_at IS NULL AND t.expires_at > NOW() AND t.purpose = 'login'
    ORDER BY t.created_at DESC LIMIT 20
  `);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mos2.on.tc';
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    tokenId: Number(r.id),
    userId: Number(r.user_id),
    userEmail: String(r.email),
    userName: String(r.name ?? ''),
    url: `${baseUrl}/auth/verify?token=${r.token}`,
    expiresAt: r.expires_at instanceof Date ? r.expires_at.toISOString() : String(r.expires_at),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}
