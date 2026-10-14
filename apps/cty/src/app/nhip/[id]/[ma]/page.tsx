import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { nganTheoKhoa } from '@/components/ngan/noi-dung';
import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';

/** /nhip/<người>/<việc> — trang đầy đủ của một đầu việc tự làm (cùng nội dung với ngăn `nhip:<người>/<việc>`). */
export default async function TrangNhip({ params, searchParams }: { params: Promise<{ id: string; ma: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id, ma } = await params;
  const me = await getCurrentUser(); if (!me) redirect(loginUrl(`/nhip/${id}/${ma}`));
  const n = await nganTheoKhoa(`nhip:${id}/${ma}`, me.role === 'admin');
  return <><h1>{n.tieuDe}</h1>{n.than}<ChongNgan ngan={(await searchParams).ngan} /></>;
}
