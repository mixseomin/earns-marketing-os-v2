import { LoginPage } from '@/components/login-page';
import { getCurrentUser, needsBootstrap, loginWithOnTcSso, ssoGateUrl } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LoginRoute({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (me) redirect(sp.next ?? '/');
  // Đã qua cổng Google .on.tc rồi thì vào thẳng, không bắt gõ lại mật khẩu.
  // `error` trên URL = vừa bị cổng từ chối → đừng thử lại, tránh vòng lặp chuyển hướng.
  if (!sp.error) {
    const sso = await loginWithOnTcSso();
    if (sso.ok) redirect(sp.next ?? '/');
    if (sso.error) redirect('/login?error=' + encodeURIComponent(sso.error));
  }
  const bootstrap = await needsBootstrap();
  return <LoginPage nextUrl={sp.next ?? '/'} bootstrapMode={bootstrap} initialError={sp.error} ssoUrl={await ssoGateUrl(sp.next ?? '/')} />;
}
