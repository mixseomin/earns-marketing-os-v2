import { redirect } from 'next/navigation';
import { PubPortal } from '@/components/pub-portal';
import { offersForPublisher, listCatalog } from '@/lib/network/data';
import { networkReport } from '@/lib/network/report';
import { currentPublisher } from '@/lib/network/auth';
import { PUB_ORIGIN } from '@/lib/network/link';

export const dynamic = 'force-dynamic';

export default async function PubRoute() {
  // Danh tính RIÊNG của publisher (cookie pub-session, host-only). Phiên MOS2 không mở được trang
  // này, và ngược lại — hai hệ không dùng chung cookie nào.
  const pub = await currentPublisher();
  if (!pub) redirect('/pub/login');
  const [offers, catalog, report] = await Promise.all([
    offersForPublisher(pub.id), listCatalog(), networkReport(365),
  ]);
  // Chỉ đưa dòng THEO DÕI ĐƯỢC xuống portal. Offer không có ô sub-id thì dựng ra cũng không quy
  // được đơn về ai — bày ra chỉ để publisher bấm rồi ăn câu từ chối.
  const pickable = catalog.filter((c) => c.trackable);
  return (
    <PubPortal pubSlug={pub.slug} pubName={pub.name} offers={offers} catalog={pickable}
      report={report} origin={PUB_ORIGIN} />
  );
}
