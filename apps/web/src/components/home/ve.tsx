// HÀM VẼ TỪNG WIDGET của /home (phía máy chủ). Mỗi mã trong sổ lib/home/so.ts có đúng MỘT hàm ở đây — kiểu `Record<MaWidget, Ve>` bắt thiếu ngay lúc kiểm kiểu.
// Quy tắc: widget KHÔNG tự tính số — gọi lại đúng khối + đúng hàm đọc của trang chủ cũ, nên số ở /home và ở `/` luôn khớp. Khối lớn có nhiều mục
// (Ethopex, Social, Máy Đăng, Máy SX, Phủ) vẽ từng phần qua tham số `chi` / `phan` của chính khối đó, không chép mã.
// Khối phía trình duyệt nạp bằng next/dynamic: màn nào có widget nào thì trình duyệt mới tải mã của widget đó (anh 20/11/2026 "không được load nặng").
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import type { MaWidget } from '@/lib/home/so';
import type { PhuPhan } from '@/components/phu-view';
import { docChiAi, docDuAn, docNguPhu, docThuTheoNgay } from '@/lib/home/du-lieu';
import { wrapExternalUrl } from '@/lib/external-url';
import { theSoChinh } from '@/components/trang-chu/so-chinh';
import { LenhMt5 } from '@/components/trang-chu/lenh-mt5';
import { DuAnLuoi } from '@/components/trang-chu/du-an';
import { EthopexKhoi, SocialKhoi } from '@/components/trang-chu/khoi-lon';
import { AffiliateOffersPanel } from '@/components/affiliate-offers-panel';
import { AwinDailyPanel } from '@/components/awin-daily-panel';
import { AwarenessFunnelPanel } from '@/components/awareness-funnel-panel';
import { AiUsageCard } from '@/components/ai-usage-card';
import { TaiSanMaTran, TaiSanShop, TaiSanSo, TaiSanVideoNgan, TaiSanWeb, kySocial } from '@/components/tai-san-tab';
import { KenhNoiDungTab } from '@/components/kenh-noi-dung-tab';
import { SeoMotSite } from '@/components/seo-tab';
import { SteamsoloLangPanel } from '@/components/steamsolo-lang-panel';
import { MailwizzListsPanel } from '@/components/mailwizz-lists-panel';
import { ThuVienTab } from '@/components/thu-vien-tab';

const PhuView = dynamic(() => import('@/components/phu-view').then((m) => m.PhuView));
const PhuCanChuY = dynamic(() => import('@/components/phu-view').then((m) => m.PhuCanChuY));
const RevenueCalendar = dynamic(() => import('@/components/revenue-calendar').then((m) => m.RevenueCalendar));
const SoChinhHome = dynamic(() => import('@/components/home/so-chinh-home').then((m) => m.SoChinhHome));
const DeliverabilityCard = dynamic(() => import('@/components/deliverability-card').then((m) => m.DeliverabilityCard));
const MayDangView = dynamic(() => import('@/components/may-dang-view').then((m) => m.MayDangView));
const MaySxView = dynamic(() => import('@/components/may-sx-view').then((m) => m.MaySxView));

/** ngữ cảnh chung của một lượt xem — đọc từ URL, cùng tên tham số với trang chủ cũ (?p ?days ?ky ?tv) */
export type Ngu = { p?: string; days: number; ky?: string; tv?: string };
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
async function DuAn() { return <DuAnLuoi projects={await docDuAn()} />; }

const LOI_TAT: { ten: string; href: string; ngoai?: true; chu: string }[] = [
  { ten: 'Luật campaign', href: 'https://be.adfond.com/luat', ngoai: true, chu: 'thư viện luật điều hành campaign (be.adfond)' },
  { ten: 'Strategy Tests', href: '/p/strategy-lab/strategy-tests', chu: 'backtest + forward-test các strategy' },
  { ten: 'Keyword Research', href: '/seo/keyword-research', chu: 'tra từ khoá' },
  { ten: 'Lịch doanh thu', href: '/revenue', chu: 'lịch tiền chi tiết mọi nguồn' },
];
function LoiTat() {
  const kieu = { display: 'grid', gap: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', textDecoration: 'none', color: 'var(--fg-0)' } as const;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {LOI_TAT.map((l) => l.ngoai
        ? <a key={l.href} href={wrapExternalUrl(l.href)} target="_blank" rel="noreferrer" style={kieu}><b>{l.ten} ↗</b><small style={{ color: 'var(--fg-3)' }}>{l.chu}</small></a>
        : <Link key={l.href} href={l.href} prefetch={false} style={kieu}><b>{l.ten}</b><small style={{ color: 'var(--fg-3)' }}>{l.chu}</small></Link>)}
    </div>
  );
}

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
  D1: (n) => <TaiSanSo ky={kySocial(n.ky)} />,
  D2: (n) => <TaiSanWeb ky={kySocial(n.ky)} />,
  D3: (n) => <TaiSanShop ky={kySocial(n.ky)} />,
  D4: (n) => <TaiSanVideoNgan ky={kySocial(n.ky)} />,
  D5: (n) => <TaiSanMaTran ky={kySocial(n.ky)} />,
  D6: (n) => <KenhNoiDungTab ky={n.ky} anKy />,
  E1: () => <SeoMotSite />,
  E2: () => <SteamsoloLangPanel />,
  F1: () => <MailwizzListsPanel />,
  F2: () => <DeliverabilityCard chi="table" />,
  F3: () => <DeliverabilityCard chi="warmup" />,
  F4: () => <DeliverabilityCard chi="seed" />,
  F5: () => <DeliverabilityCard chi="engagement" />,
  F6: () => <DeliverabilityCard chi="calendar" />,
  G1: () => <DuAn />,
  H1: () => <EthopexKhoi chi="so" />,
  H2: () => <EthopexKhoi chi="camp" />,
  H3: () => <EthopexKhoi chi="ngay" />,
  H4: () => <EthopexKhoi chi="tl" />,
  H5: () => <EthopexKhoi chi="phim" />,
  H6: () => <EthopexKhoi chi="cho" />,
  H7: () => <EthopexKhoi chi="test" />,
  H8: () => <EthopexKhoi chi="luat" />,
  I1: () => <SocialKhoi chi="suc" />,
  I2: () => <SocialKhoi chi="pheu" />,
  I3: () => <SocialKhoi chi="ratien" />,
  I4: () => <SocialKhoi chi="canhbao" />,
  I5: () => <SocialKhoi chi="pho" />,
  I6: () => <SocialKhoi chi="goc" />,
  I7: () => <SocialKhoi chi="kehoach" />,
  I8: () => <SocialKhoi chi="sx" />,
  I9: () => <SocialKhoi chi="kenh" />,
  I10: () => <SocialKhoi chi="lich" />,
  I11: () => <SocialKhoi chi="landing" />,
  I12: () => <SocialKhoi chi="trang" />,
  I13: () => <SocialKhoi chi="tien" />,
  K1: () => <MayDangView chi="so" />,
  K2: () => <MayDangView chi="luot" />,
  K3: () => <MayDangView chi="loi" />,
  K4: () => <MayDangView chi="may" />,
  K5: () => <MaySxView chi="viec" />,
  K6: () => <MaySxView chi="luot" />,
  K7: () => <MayDangView chi="lich" />,
  L1: (n) => <ThuVienTab tv={n.tv} />,
  L2: () => <LoiTat />,
};
