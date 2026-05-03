import { LoginPage } from '@/components/login-page';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LoginRoute({ searchParams }: { searchParams: Promise<{ next?: string; bootstrap?: string; error?: string }> }) {
  const sp = await searchParams;
  // Already logged in → redirect home
  const me = await getCurrentUser();
  if (me) {
    redirect(sp.next ?? '/');
  }
  return <LoginPage nextUrl={sp.next ?? '/'} bootstrapToken={sp.bootstrap} initialError={sp.error} />;
}
