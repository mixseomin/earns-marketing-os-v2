import { redirect } from 'next/navigation';
import { PubPortal } from '@/components/pub-portal';
import { offersForPublisher, catalogForPublisher } from '@/lib/network/data';
import { networkReport, pubView } from '@/lib/network/report';
import { currentPublisher } from '@/lib/network/auth';
import { PUB_ORIGIN } from '@/lib/network/link';

export const dynamic = 'force-dynamic';

export default async function PubRoute() {
  // Danh tính RIÊNG của publisher (cookie pub-session, host-only). Phiên MOS2 không mở được trang
  // này, và ngược lại — hai hệ không dùng chung cookie nào.
  const pub = await currentPublisher();
  if (!pub) redirect('/pub/login');
  const [offers, catalog, report] = await Promise.all([
    offersForPublisher(pub.id), catalogForPublisher(pub.id), networkReport(365),
  ]);
  // pubView cắt báo cáo về đúng phần của họ VÀ quy tiền về mức họ hưởng. Truyền cả `report` xuống
  // là gửi kèm đơn của publisher khác + số upstream trả mình — không hiện vẫn đọc được trong payload.
  return (
    <PubPortal pubName={pub.name} offers={offers} catalog={catalog}
      view={pubView(report, pub.slug)} origin={PUB_ORIGIN} />
  );
}
