// Phiên dùng chung .on.tc: cookie `mos2-session` do mos2.on.tc cấp (domain .on.tc) → app này chỉ KIỂM trong auth_sessions của cùng DB,
// không có cửa đăng nhập riêng (luật: tool nội bộ không có login riêng). Chưa có phiên → đẩy sang mos2.on.tc/login?next=<url này>.
// Cùng cách xử lý như apps/xuong-video/src/lib/auth.ts (đọc MỌI giá trị mos2-session trong header).
import 'server-only';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export type AuthUser = { id: number; email: string; displayName: string; role: 'admin' | 'operator' | 'viewer' };

export async function getCurrentUser(): Promise<AuthUser | null> {
  const raw = (await headers()).get('cookie') || '';
  const tokens = Array.from(raw.matchAll(/(?:^|;\s*)mos2-session=([^;]+)/g)).map((m) => (m[1] ?? '').trim()).filter(Boolean);
  if (!tokens.length) return null;
  const db = getDb();
  if (!db) return null;
  for (const token of tokens) {
    const rows = (await db.execute(sql`
      SELECT s.user_id, u.email, u.name, m.display_name, m.role
      FROM auth_sessions s JOIN users u ON u.id = s.user_id
      LEFT JOIN members m ON m.user_id = s.user_id AND m.project_id IS NULL
      WHERE s.session_token = ${token} AND s.revoked_at IS NULL AND s.expires_at > NOW() LIMIT 1`)) as unknown as Array<Record<string, unknown>>;
    const r = rows[0];
    if (!r) continue;
    return { id: Number(r.user_id), email: String(r.email), displayName: String(r.display_name ?? r.name ?? ''), role: String(r.role ?? 'viewer') as AuthUser['role'] };
  }
  return null;
}

export const BASE_URL = (process.env.CTY_BASE_URL || 'https://cty.on.tc').replace(/\/$/, '');
export const loginUrl = (next = '/') => `https://mos2.on.tc/login?next=${encodeURIComponent(BASE_URL + next)}`;
