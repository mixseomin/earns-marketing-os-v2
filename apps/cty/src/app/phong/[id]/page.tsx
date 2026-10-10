import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { phong } from '@/lib/cong-ty';
import { nganPhong } from '@/components/ngan/noi-dung';

import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';

export default async function TrangPhong({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const me = await getCurrentUser(); if (!me) redirect(loginUrl(`/phong/${id}`));
  if (!phong(id)) notFound();
  const n = nganPhong(id, me.role === 'admin');
  return <><h1>{n.tieuDe}</h1>{n.than}<ChongNgan ngan={(await searchParams).ngan} /></>;
}
