import { redirect } from 'next/navigation';
import { NetworkAdmin } from '@/components/network-admin';
import { listOffers, listPublishers, listRegistrations, listUsers, listCatalog } from '@/lib/network/data';
import { networkReport } from '@/lib/network/report';
import { parseRange, ALL_DAYS } from '@/lib/revenue/by-day';
import { getCurrentUser } from '@/lib/auth';
import { PUB_ORIGIN } from '@/lib/network/link';

export const dynamic = 'force-dynamic';

export default async function NetworkAdminRoute({ searchParams }: {
  searchParams: Promise<{ days?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/network');
  if (me.role !== 'admin') redirect('/pub');
  // Cùng bộ chip khung thời gian với /revenue — hai trang nói về cùng số tiền thì phải cùng cách cắt.
  const days = parseRange((await searchParams).days);
  const [offers, publishers, registrations, report, users, catalog] = await Promise.all([
    listOffers(), listPublishers(), listRegistrations(), networkReport(days || ALL_DAYS),
    listUsers(), listCatalog(),
  ]);
  return (
    <NetworkAdmin
      offers={offers} publishers={publishers} registrations={registrations} report={report}
      users={users} catalog={catalog} days={days}
      origin={PUB_ORIGIN}
    />
  );
}
