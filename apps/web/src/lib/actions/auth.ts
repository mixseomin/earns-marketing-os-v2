'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  loginWithPassword as _login,
  setUserPassword as _setPassword,
  bootstrapAdminPassword as _bootstrap,
  logout as _logout,
  getCurrentUser,
} from '@/lib/auth';

export async function loginAction(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  return _login(email, password);
}

export async function setPasswordAction(targetUserId: number, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' };
  // Admin can set anyone's password; non-admin can only set own
  if (me.role !== 'admin' && me.id !== targetUserId) return { ok: false, error: 'FORBIDDEN' };
  return _setPassword(targetUserId, newPassword);
}

export async function bootstrapAdminAction(token: string, password: string): Promise<{ ok: boolean; error?: string }> {
  return _bootstrap(token, password);
}

export async function logoutAction(): Promise<void> {
  await _logout();
  revalidatePath('/');
  redirect('/login');
}
