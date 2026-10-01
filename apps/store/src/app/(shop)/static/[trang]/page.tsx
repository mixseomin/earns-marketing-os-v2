import { notFound } from 'next/navigation';
import { shopHienTai } from '@/lib/shop';
import { TRANG_TINH } from '@mos2/shop/mat-tien';

type P = { params: Promise<{ trang: string }> };
export async function generateMetadata({ params }: P) {
  const k = (await params).trang;
  return { title: TRANG_TINH.find((t) => t.khoa === k)?.ten ?? 'Policy' };
}
export default async function TrangTinh({ params }: P) {
  const s = await shopHienTai(); if (!s) notFound();
  const t = s.mt.trang[(await params).trang];
  if (!t) notFound();
  return <div className="khung trang"><h1>{t.tieu_de}</h1><div className="noi-dung" dangerouslySetInnerHTML={{ __html: t.html }} /></div>;
}
