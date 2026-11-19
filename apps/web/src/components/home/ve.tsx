// HÀM VẼ TỪNG WIDGET của /home (phía máy chủ). Mỗi mã trong sổ lib/home/so.ts có đúng MỘT hàm ở đây — kiểu `Record<MaWidget, Ve>` bắt thiếu ngay lúc kiểm kiểu.
// Quy tắc: widget KHÔNG tự tính số — gọi lại đúng khối + đúng hàm đọc của trang chủ cũ (lib/home/du-lieu.ts), nên số ở /home và ở `/` luôn khớp.
// Khối phía trình duyệt nạp bằng next/dynamic: màn nào có widget nào thì trình duyệt mới tải mã của widget đó (anh 20/11/2026 "không được load nặng").
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import type { MaWidget } from '@/lib/home/so';
import type { PhuPhan } from '@/components/phu-view';
import { docChiAi, docDuAn, docNguPhu, docThuTheoNgay } from '@/lib/home/du-lieu';
import { theSoChinh } from '@/components/trang-chu/so-chinh';
import { LenhMt5 } from '@/components/trang-chu/lenh-mt5';
import { AffiliateOffersPanel } from '@/components/affiliate-offers-panel';
import { AwinDailyPanel } from '@/components/awin-daily-panel';
import { AwarenessFunnelPanel } from '@/components/awareness-funnel-panel';
import { AiUsageCard } from '@/components/ai-usage-card';

const PhuView = dynamic(() => import('@/components/phu-view').then((m) => m.PhuView));
const PhuCanChuY = dynamic(() => import('@/components/phu-view').then((m) => m.PhuCanChuY));
const RevenueCalendar = dynamic(() => import('@/components/revenue-calendar').then((m) => m.RevenueCalendar));
const SoChinhHome = dynamic(() => import('@/components/home/so-chinh-home').then((m) => m.SoChinhHome));

/** ngữ cảnh chung của một lượt xem — đọc từ URL, cùng tên tham số với trang chủ cũ (?p, ?days) */
export type Ngu = { p?: string; days: number };
type Ve = (n: Ngu) => ReactNode;

const ChuaCoSoPhu = () => <EmptyState icon="🧭" title="Chưa dự án nào có sổ phủ" description="Adapter hoặc cổng nhận số khai vào là hiện ở đây." compact />;

async function SoChinh({ n }: { n: Ngu }) {
  const [byDay, ngu, duAn] = await Promise.all([docThuTheoNgay(30), docNguPhu(n.p, n.days), docDuAn()]);
  return <SoChinhHome the={theSoChinh({ byDay, phu: ngu.phu, pid: ngu.pid, days: n.days, soDuAn: duAn.length }).the} />;
}
async function CanChuY({ n }: { n: Ngu }) {
  const { phu } = await docNguPhu(n.p, n.days);
  if (!phu) return <ChuaCoSoPhu />;
  return <PhuCanChuY data={phu} luonMo rong={<EmptyState icon="✓" title="Không có gì cần chú ý" compact />} />;
}
async function Phu({ n, phan }: { n: Ngu; phan: PhuPhan }) {
  const { pid, phu, host } = await docNguPhu(n.p, n.days);
  if (!phu || !pid) return <ChuaCoSoPhu />;
  return <PhuView data={phu} projectId={pid} host={host} phan={phan} />;
}
async function LichDoanhThu() {
  const byDay = await docThuTheoNgay(30);
  return (<>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6, fontSize: 11, color: 'var(--fg-3)' }}>
      <span>30 ngày gần nhất · mọi nguồn</span>
      <Link href="/revenue" prefetch={false} style={{ color: 'var(--accent)', textDecoration: 'none' }}>Lịch chi tiết →</Link>
    </div>
    <RevenueCalendar rows={byDay.rows} errors={byDay.errors} scannedNetworks={byDay.scannedNetworks} foldCalendar />
  </>);
}
async function ChiAi() { return <AiUsageCard usage={await docChiAi()} />; }

export const VE: Record<MaWidget, Ve> = {
  A1: (n) => <SoChinh n={n} />,
  A2: (n) => <CanChuY n={n} />,
  B1: (n) => <Phu n={n} phan="camp" />,
  B2: (n) => <Phu n={n} phan="phu" />,
  B3: (n) => <Phu n={n} phan="nguon" />,
  B4: (n) => <Phu n={n} phan="lander" />,
  B5: (n) => <Phu n={n} phan="adapter" />,
  C1: () => <LichDoanhThu />,
  C2: () => <AffiliateOffersPanel />,
  C3: () => <AwinDailyPanel />,
  C4: () => <AwarenessFunnelPanel />,
  C5: () => <ChiAi />,
  C6: () => <LenhMt5 />,
};
