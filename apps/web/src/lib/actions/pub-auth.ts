'use server';

// Hành động đăng nhập của publisher. Tách khỏi actions/network.ts (việc của admin) để không ai
// lỡ tay gọi nhầm hàm admin từ portal.

import { redirect } from 'next/navigation';
import { pubLogin, pubLogout, setPasswordByToken, pubChangePassword, currentPublisher } from '@/lib/network/auth';

export async function loginAction(email: string, password: string) {
  return pubLogin(email, password);
}

export async function logoutAction() {
  await pubLogout();
  redirect('/pub/login');
}

export async function setPasswordAction(token: string, password: string) {
  return setPasswordByToken(token, password);
}

export async function changePasswordAction(current: string, next: string) {
  const me = await currentPublisher();
  if (!me) return { ok: false, error: 'Chưa đăng nhập' };
  return pubChangePassword(me.id, current, next);
}
