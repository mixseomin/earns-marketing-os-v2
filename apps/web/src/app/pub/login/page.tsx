import { redirect } from 'next/navigation';
import { PubLogin } from '@/components/pub-login';
import { currentPublisher } from '@/lib/network/auth';

export const dynamic = 'force-dynamic';

export default async function PubLoginRoute() {
  if (await currentPublisher()) redirect('/pub');
  return <PubLogin />;
}
