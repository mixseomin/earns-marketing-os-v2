import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { docText } from '@/lib/cong-ty';
import { Md } from '@/components/md';
export const dynamic = 'force-dynamic';
export default async function Luat() {
  const me = await getCurrentUser(); if (!me) redirect(loginUrl('/luat'));
  return <Md>{docText('AGENTS.md')}</Md>;
}
