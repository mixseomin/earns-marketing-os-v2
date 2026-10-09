// /thu-vien — trang dự phòng cho link cũ; trong app thư viện mở bằng drawer (moNgan thu-vien).
import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { ThuVienNoiDung } from '@/components/thu-vien';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thư viện điện ảnh' };

export default async function ThuVien({ searchParams }: { searchParams: Promise<{ tl?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl('/thu-vien'));
  return <div><h2 style={{ margin: '0 0 6px' }}>🎬 Thư viện điện ảnh</h2><ThuVienNoiDung tlDau={(await searchParams).tl || ''} /></div>;
}
