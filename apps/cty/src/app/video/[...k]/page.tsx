import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { nganTheoKhoa } from '@/components/ngan/noi-dung';
import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';

/** /video/<phòng>/<slug> — trang đầy đủ của một video ngắn (cùng nội dung với ngăn `video:<phòng>/<slug>`). */
export default async function TrangVideo({ params, searchParams }: { params: Promise<{ k: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { k } = await params; const khoa = k.map(decodeURIComponent).join('/');
  const me = await getCurrentUser(); if (!me) redirect(loginUrl(`/video/${khoa}`));
  if (k.length !== 2) notFound();
  const n = await nganTheoKhoa(`video:${khoa}`, me.role === 'admin');
  return <><h1>{n.tieuDe}</h1>{n.than}<ChongNgan ngan={(await searchParams).ngan} /></>;
}
