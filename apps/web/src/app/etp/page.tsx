// etp.on.tc (anh 24/10/2026: "hệ thống quản lý backend riêng tập trung chạy trên subdomain on.tc"): quản lý camp / creative / ROI từ kho `etp`.
// nginx etp.on.tc gác bằng SSO mos2 (auth_request → /api/auth/verify) rồi chuyển / → /etp; chỉ admin.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { docEtp } from '@/lib/etp-doc';
import { EtpView } from '@/components/etp-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ETP · camp', robots: { index: false, follow: false } };

// ?t=<tab>&v=<kiểu xem> đọc NGAY trên máy chủ → lần vẽ đầu đã đúng tab (anh 25/10/2026: F5 ở ?t=camp&v=bang bị về Tổng quan —
// trước đây tab mặc định 'tong' rồi trình duyệt mới đọc URL, lượt ghi URL chạy với giá trị mặc định đè mất lựa chọn)
export default async function EtpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const me = await getCurrentUser();
  // đăng nhập lại thì quay về ĐÚNG chỗ đang xem (giữ ?t=…&v=…&l=…), không rơi về /etp trần
  if (!me) redirect(`/login?next=${encodeURIComponent(`/etp?${new URLSearchParams(Object.entries(q).filter(([, v]) => typeof v === 'string') as [string, string][]).toString()}`)}`);
  if (me.role !== 'admin') redirect('/');
  const mot = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : undefined);
  return <EtpView du={await docEtp()} dauVao={{ t: mot('t'), v: mot('v'), l: mot('l'), p: mot('p'), lu: mot('lu'), d: mot('d'), b: mot('b') }} />;
}
