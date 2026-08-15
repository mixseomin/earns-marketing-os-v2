import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { NetworkAdmin } from '@/components/network-admin';
import { listOffers, listPublishers, listRegistrations } from '@/lib/network/data';
import { networkReport } from '@/lib/network/report';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function NetworkAdminRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/network');
  if (me.role !== 'admin') redirect('/pub');
  const h = await headers();
  const [offers, publishers, registrations, report] = await Promise.all([
    listOffers(), listPublishers(), listRegistrations(), networkReport(365),
  ]);
  return (
    <NetworkAdmin
      offers={offers} publishers={publishers} registrations={registrations} report={report}
      origin={`https://${h.get('host') ?? 'pub.on.tc'}`}
    />
  );
}
