import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { nganTheoKhoa } from '@/components/ngan/noi-dung';
import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';

/** /the/<id> — trang đầy đủ của một card plays (cùng nội dung với ngăn `the:<id>`). */
export default async function TrangThe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const me = await getCurrentUser(); if (!me) redirect(loginUrl(`/the/${id}`));
  if (!/^\d+$/.test(id)) notFound();
  const n = await nganTheoKhoa(`the:${id}`, me.role === 'admin');
  return <><h1>{n.tieuDe}</h1>{n.than}<ChongNgan ngan={(await searchParams).ngan} /></>;
}
