// /outreach — outreach.on.tc (anh 20/11/2026: "xây hệ thống outreach cho nhiều dự án, nhiều kiểu; trình bày kiểu widget như trang home").
// Cùng khung trang widget với /home (components/home/trang.tsx, prop so="outreach"); sổ widget + màn ở lib/outreach/so.ts, ruột do components/outreach-tong/ve.tsx vẽ.
// Số đọc từ các bảng outreach sẵn có của MOS2 cho MỌI dự án; ?da=<dự án> lọc một dự án. Việc sửa từng chiến dịch / người nhận vẫn ở trang outreach của dự án
// (/p/<dự án>/outreach) — bấm tên là mở trang đó tại chỗ trong ngăn trang nhúng.
import { Suspense, type ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import '../home/home.css';
import { getCurrentUser } from '@/lib/auth';
import { HomeTrang } from '@/components/home/trang';
import { VE_OB, type NguOb } from '@/components/outreach-tong/ve';
import { docBoCucHome } from '@/lib/home/bo-cuc';
import { KHUNG_COOKIE, docTuyChon } from '@/lib/home/so';
import { BO_SO, manCuaBo } from '@/lib/luoi-trang/bo-so';
import { coWidgetOb, type MaWidgetOb } from '@/lib/outreach/so';
import { docDuAnOutreach } from '@/lib/outreach/du-lieu';

export const dynamic = 'force-dynamic';

const gioVn = () => { const d = new Date(Date.now() + 7 * 3600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

export default async function OutreachPage({ searchParams }: { searchParams: Promise<{ man?: string; da?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/outreach');
  if (me.role !== 'admin') redirect('/');
  const man = manCuaBo(BO_SO.outreach, sp.man);
  const [{ o, nguon }, ck, duAn] = await Promise.all([docBoCucHome(me.id, man.id), cookies(), docDuAnOutreach()]);
  const da = duAn.includes(sp.da ?? '') ? sp.da : undefined, n: NguOb = { da };
  // chỉ vẽ tab ĐANG MỞ của từng ô; mỗi widget một Suspense riêng nên cái nào xong hiện trước
  const noi: Record<string, ReactNode> = {};
  for (const c of o) if (coWidgetOb(c.ma)) noi[c.ma] = <Suspense fallback={<div className="hm-cho">đang đọc…</div>}>{VE_OB[c.ma as MaWidgetOb](n)}</Suspense>;
  return (
    <HomeTrang so="outreach" manId={man.id} tuy={docTuyChon(ck.get(KHUNG_COOKIE)?.value)} bo={o} nguon={nguon} noi={noi} docLuc={gioVn()}
      ngu={{ duAnPhu: [], days: 7, ky: 7, duAn, da }} />
  );
}
