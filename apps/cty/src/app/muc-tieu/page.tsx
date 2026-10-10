import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { nganMucTieu } from '@/components/ngan/noi-dung';
import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';
export default async function MucTieu({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await getCurrentUser())) redirect(loginUrl('/muc-tieu'));
  const n = nganMucTieu();
  return <><h1>{n.tieuDe}</h1>{n.than}<ChongNgan ngan={(await searchParams).ngan} /></>;
}
