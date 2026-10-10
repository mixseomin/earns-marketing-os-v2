// cty.on.tc — sơ đồ tổ chức VẼ (cây, avatar, bấm được). Chữ ở mức một dòng trạng thái; chi tiết nằm sau cú bấm.
import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { dsPhong, dsNhanSu } from '@/lib/cong-ty';
import { SoDoToChuc } from '@/components/so-do-to-chuc';

import { ChongNgan } from '@/components/ngan/chong';

export const dynamic = 'force-dynamic';

export default async function Trang({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await getCurrentUser();
  if (!me) redirect(loginUrl('/'));
  const phong = dsPhong(); const ns = dsNhanSu();
  return (
    <>
      <p className="cty-mono cty-muted" style={{ margin: '0 0 .5rem' }}>{ns.length} nhân sự · {phong.length} phòng · tham quan, chưa hoạt động · bấm vào người hoặc phòng</p>
      <SoDoToChuc phong={phong} ns={ns} />
      <ChongNgan ngan={(await searchParams).ngan} />
    </>
  );
}
