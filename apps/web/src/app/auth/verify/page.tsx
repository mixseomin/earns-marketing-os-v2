import { redirect } from 'next/navigation';
import { verifyMagicLink } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function VerifyRoute({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const sp = await searchParams;
  const token = sp.token?.trim();
  if (!token) redirect('/login?error=missing-token');
  const res = await verifyMagicLink(token);
  if (!res.ok) {
    const msg = encodeURIComponent(res.error || 'Verify thất bại');
    redirect(`/login?error=${msg}`);
  }
  redirect(sp.next ?? '/');
}
