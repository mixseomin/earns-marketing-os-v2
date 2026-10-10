import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { docText } from '@/lib/cong-ty';
import { Md } from '@/components/md';
export const dynamic = 'force-dynamic';
export default async function MucTieu() {
  const me = await getCurrentUser(); if (!me) redirect(loginUrl('/muc-tieu'));
  return <Md>{docText('muc-tieu.md')}</Md>;
}
