import { redirect } from 'next/navigation';
import { PubPortal } from '@/components/pub-portal';
import { publisherForUser, offersForPublisher } from '@/lib/network/data';
import { networkReport } from '@/lib/network/report';
import { getCurrentUser } from '@/lib/auth';
import { PUB_ORIGIN } from '@/lib/network/link';
import { EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function PubRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/pub');
  const pub = await publisherForUser(me.id);
  // Nói thẳng chưa gắn publisher, đừng trả trang rỗng — trang rỗng trông y hệt "chưa có đơn nào".
  if (!pub) {
    return (
      <div className="page" style={{ padding: 16, height: '100dvh', overflowY: 'auto' }}>
        <EmptyState icon="🔌" title="Tài khoản này chưa gắn với publisher nào"
          description={`Admin vào /network gán user #${me.id} (${me.email}) cho một publisher.`} />
      </div>
    );
  }
  const [offers, report] = await Promise.all([offersForPublisher(pub.id), networkReport(365)]);
  return (
    <PubPortal pubSlug={pub.slug} pubName={pub.name} offers={offers} report={report}
      origin={PUB_ORIGIN} />
  );
}
