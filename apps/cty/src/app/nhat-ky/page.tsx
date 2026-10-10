import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { SoSuKien } from '@/components/so-su-kien';

import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';

export default async function NhatKy({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await getCurrentUser(); if (!me) redirect(loginUrl('/nhat-ky'));
  const sp = await searchParams;
  const q = Object.fromEntries(Object.entries(sp).filter(([k]) => k !== 'ngan').map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return <><SoSuKien q={q} /><ChongNgan ngan={sp.ngan} /></>;
}
