import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { nganTheoKhoa } from '@/components/ngan/noi-dung';
import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';

/** /day-chuyen/<phòng>/<dây chuyền>[/<lọc>] — trang đầy đủ của một dây chuyền (cùng nội dung với ngăn `day-chuyen:…`). */
export default async function TrangDayChuyen({ params, searchParams }: { params: Promise<{ k: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { k } = await params; const khoa = k.map(decodeURIComponent).join('/');
  const me = await getCurrentUser(); if (!me) redirect(loginUrl(`/day-chuyen/${khoa}`));
  if (k.length < 2 || k.length > 3) notFound();
  const n = await nganTheoKhoa(`day-chuyen:${khoa}`, me.role === 'admin');
  return <><h1>{n.tieuDe}</h1>{n.than}<ChongNgan ngan={(await searchParams).ngan} /></>;
}
