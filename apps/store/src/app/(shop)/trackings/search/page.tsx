import { TheoDoi } from '@/components/theo-doi';

export const metadata = { title: 'Order Tracking' };
type P = { searchParams: Promise<{ order?: string; key?: string }> };

export default async function TrangTheoDoi({ searchParams }: P) {
  const q = await searchParams;
  return <div className="khung trang" style={{ maxWidth: 720 }}><h1>Track your order</h1><TheoDoi order={q.order ?? ''} khoa={q.key ?? ''} /></div>;
}
