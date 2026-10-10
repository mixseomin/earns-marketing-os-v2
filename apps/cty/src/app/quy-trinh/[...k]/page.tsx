import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { nganTheoKhoa } from '@/components/ngan/noi-dung';
import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';

/** /quy-trinh/<phòng>/<quy-trình> — trang đầy đủ của một quy trình (cùng nội dung với ngăn `quy-trinh:<phòng>/<quy-trình>`). */
export default async function TrangMotQuyTrinh({ params, searchParams }: { params: Promise<{ k: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { k } = await params; const khoa = k.map(decodeURIComponent).join('/');
  const me = await getCurrentUser(); if (!me) redirect(loginUrl(`/quy-trinh/${khoa}`));
  if (k.length !== 2) notFound();
  const n = await nganTheoKhoa(`quy-trinh:${khoa}`, me.role === 'admin');
  return <><h1>{n.tieuDe}</h1>{n.than}<ChongNgan ngan={(await searchParams).ngan} /></>;
}
