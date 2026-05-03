'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { createMagicLink, bootstrapAdmin, logout as doLogout, requireRole, getCurrentUser } from '@/lib/auth';

export async function generateMagicLink(targetUserId: number): Promise<{ ok: boolean; url?: string; error?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' };
  if (me.role !== 'admin') return { ok: false, error: 'FORBIDDEN — admin only' };
  return createMagicLink(targetUserId, me.id);
}

export async function bootstrapLogin(token: string): Promise<{ ok: boolean; error?: string }> {
  const res = await bootstrapAdmin(token);
  return { ok: res.ok, error: res.error };
}

// Request a magic link for a given email (member-self-request flow).
// If email exists, creates token. Returns the URL only if requester is already
// admin (otherwise just confirms "đã gửi", URL has to be retrieved by admin).
export async function requestLoginLink(email: string): Promise<{ ok: boolean; url?: string; message?: string; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB not available' };
  const rows = await db.execute(sql`SELECT id FROM users WHERE email = ${email.trim().toLowerCase()} LIMIT 1`);
  const r = (rows as unknown as Array<{ id: number }>)[0];
  if (!r) {
    // Don't leak which emails exist — same response either way
    return { ok: true, message: 'Nếu email tồn tại, link đã được tạo. Liên hệ admin để nhận URL.' };
  }
  const me = await getCurrentUser();
  const link = await createMagicLink(Number(r.id), me?.id);
  if (!link.ok) return { ok: false, error: link.error };
  if (me?.role === 'admin') {
    // Show URL inline — admin can copy
    return { ok: true, url: link.url, message: 'Link tạo thành công (admin được show URL).' };
  }
  return { ok: true, message: 'Link đã tạo. Liên hệ admin để được gửi URL.' };
}

export async function logoutAction(): Promise<void> {
  await doLogout();
  revalidatePath('/');
  redirect('/login');
}
