// studio.on.tc — một màn: danh sách phim (drawer phim mở theo ?m=phim&mId=). Admin mos2 mới vào; phiên = cookie .on.tc dùng chung.
import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { dsPhim, trangThaiKhoa } from '@/lib/actions';
import { XuongVideoTrang } from '@/components/trang';

export const dynamic = 'force-dynamic';

export default async function Trang() {
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl('/'));
  if (me.role !== 'admin') return <p className="xv-mono">Tài khoản {me.email} không phải admin mos2 — xưởng video tốn tiền model nên chỉ admin dùng.</p>;
  const [phim, khoa] = await Promise.all([dsPhim(), trangThaiKhoa()]);
  return <XuongVideoTrang phimDau={phim} khoa={khoa} />;
}
