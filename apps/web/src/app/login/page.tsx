import { LoginPage } from '@/components/login-page';
import { getCurrentUser, needsBootstrap } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LoginRoute({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (me) redirect(sp.next ?? '/');
  const bootstrap = await needsBootstrap();
  return <LoginPage nextUrl={sp.next ?? '/'} bootstrapMode={bootstrap} initialError={sp.error} />;
}
