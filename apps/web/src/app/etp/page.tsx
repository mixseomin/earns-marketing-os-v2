// etp.on.tc (anh 24/10/2026: "hệ thống quản lý backend riêng tập trung chạy trên subdomain on.tc"): quản lý camp / creative / ROI từ kho `etp`.
// nginx etp.on.tc gác bằng SSO mos2 (auth_request → /api/auth/verify) rồi chuyển / → /etp; chỉ admin.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { docEtp } from '@/lib/etp-doc';
import { EtpView } from '@/components/etp-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ETP · camp', robots: { index: false, follow: false } };

export default async function EtpPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/etp');
  if (me.role !== 'admin') redirect('/');
  return <EtpView du={await docEtp()} />;
}
