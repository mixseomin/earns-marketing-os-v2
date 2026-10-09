// /log — trang dự phòng cho link cũ; trong app sổ chi phí mở bằng drawer (moNgan so-chi-phi).
import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { SoChiPhi } from '@/components/so-chi-phi';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sổ chi phí' };

export default async function Log({ searchParams }: { searchParams: Promise<{ phim?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl('/log'));
  if (me.role !== 'admin') return <p className="xv-mono">Chỉ admin.</p>;
  const p = (await searchParams).phim;
  return <div><h2 style={{ margin: '0 0 10px', fontSize: 18 }}>💰 Sổ chi phí</h2><SoChiPhi phimDau={p ? Number(p) : undefined} /></div>;
}
