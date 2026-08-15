import { redirect } from 'next/navigation';
import { PubPortal } from '@/components/pub-portal';
import { offersForPublisher } from '@/lib/network/data';
import { networkReport } from '@/lib/network/report';
import { currentPublisher } from '@/lib/network/auth';
import { PUB_ORIGIN } from '@/lib/network/link';

export const dynamic = 'force-dynamic';

export default async function PubRoute() {
  // Danh tính RIÊNG của publisher (cookie pub-session, host-only). Phiên MOS2 không mở được trang
  // này, và ngược lại — hai hệ không dùng chung cookie nào.
  const pub = await currentPublisher();
  if (!pub) redirect('/pub/login');
  const [offers, report] = await Promise.all([offersForPublisher(pub.id), networkReport(365)]);
  return (
    <PubPortal pubSlug={pub.slug} pubName={pub.name} offers={offers} report={report}
      origin={PUB_ORIGIN} />
  );
}
