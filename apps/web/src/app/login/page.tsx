import { LoginPage } from '@/components/login-page';
import { getCurrentUser, needsBootstrap, coCookieCong, ssoGateUrl } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ghepNext } from '@/lib/login-next';

export const dynamic = 'force-dynamic';

export default async function LoginRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const sp = { next: ghepNext(raw), error: typeof raw.error === 'string' ? raw.error : undefined };
  const me = await getCurrentUser();
  if (me) redirect(sp.next ?? '/');
  // Đã qua cổng Google .on.tc rồi thì vào thẳng, không bắt gõ lại mật khẩu. Việc đổi cookie cổng
  // lấy phiên nằm ở /api/auth/on-tc (trang không được phép đặt cookie).
  // `error` trên URL = vừa bị cổng từ chối → đừng thử lại, tránh vòng lặp chuyển hướng.
  if (!sp.error && await coCookieCong()) {
    redirect('/api/auth/on-tc?next=' + encodeURIComponent(sp.next ?? '/'));
  }
  const bootstrap = await needsBootstrap();
  return <LoginPage nextUrl={sp.next ?? '/'} bootstrapMode={bootstrap} initialError={sp.error} ssoUrl={await ssoGateUrl(sp.next ?? '/')} />;
}
