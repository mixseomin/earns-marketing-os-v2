// /home — trang chủ dạng WIDGET + LAYOUT (anh 20/11/2026): chỉ có thanh màn bên trái, mỗi MÀN là một bố cục widget vừa một màn hình.
// Máy chủ đọc bố cục của người xem cho màn đang mở rồi CHỈ vẽ ruột các widget có trên màn đó; mỗi widget một Suspense riêng nên cái nào xong hiện trước,
// widget chậm không giữ cả trang. Ruột do components/home/ve.tsx vẽ — dùng lại đúng khối + hàm đọc của trang chủ cũ nên số luôn khớp với `/`.
import { Suspense, type ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import './home.css';
import { getCurrentUser } from '@/lib/auth';
import { HomeTrang } from '@/components/home/trang';
import { VE, type Ngu } from '@/components/home/ve';
import { docBoCucHome } from '@/lib/home/bo-cuc';
import { docDuAnPhu, kyPhu } from '@/lib/home/du-lieu';
import { KHUNG_COOKIE, coWidget, docTuyChon, manCua, type MaWidget } from '@/lib/home/so';

export const dynamic = 'force-dynamic';

const gioVn = () => { const d = new Date(Date.now() + 7 * 3600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

export default async function HomeWidgetPage({ searchParams }: { searchParams: Promise<{ man?: string; p?: string; days?: string; ky?: string; tv?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/home');
  if (me.role !== 'admin') redirect('/');
  const man = manCua(sp.man), n: Ngu = { p: sp.p, days: kyPhu(sp.days), ky: sp.ky, tv: sp.tv };
  const [{ o, nguon }, ck, duAnPhu] = await Promise.all([docBoCucHome(me.id, man.id), cookies(), docDuAnPhu()]);
  // chỉ vẽ tab ĐANG MỞ của từng ô; đổi tab / thêm widget thì trình duyệt lưu bố cục rồi đọc lại trang để lấy ruột mới
  const noi: Record<string, ReactNode> = {};
  for (const c of o) if (coWidget(c.ma)) noi[c.ma] = <Suspense fallback={<div className="hm-cho">đang đọc…</div>}>{VE[c.ma as MaWidget](n)}</Suspense>;
  return (
    <HomeTrang manId={man.id} tuy={docTuyChon(ck.get(KHUNG_COOKIE)?.value)} bo={o} nguon={nguon} noi={noi} docLuc={gioVn()}
      ngu={{ duAnPhu, pid: duAnPhu.includes(sp.p ?? '') ? sp.p : duAnPhu[0], days: n.days, p: sp.p, daysRaw: sp.days, ky: [30, 90].includes(Number(sp.ky)) ? Number(sp.ky) : 7 }} />
  );
}
