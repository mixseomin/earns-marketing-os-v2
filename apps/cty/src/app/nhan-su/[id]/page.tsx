import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { nhanSu } from '@/lib/cong-ty';
import { nganNhanSu } from '@/components/ngan/noi-dung';

import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';

export default async function TrangNhanSu({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!(await getCurrentUser())) redirect(loginUrl(`/nhan-su/${id}`));
  if (!nhanSu(id)) notFound();
  const n = nganNhanSu(id);
  return <><h1>{n.tieuDe}</h1>{n.than}<ChongNgan ngan={(await searchParams).ngan} /></>;
}
