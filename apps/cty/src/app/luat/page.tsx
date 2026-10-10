import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { nganLuat } from '@/components/ngan/noi-dung';
import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';
export default async function Luat({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await getCurrentUser())) redirect(loginUrl('/luat'));
  return <>{nganLuat().than}<ChongNgan ngan={(await searchParams).ngan} /></>;
}
