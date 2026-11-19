import { EthopexKhoi, SocialKhoi } from '@/components/trang-chu/khoi-lon';
import { Suspense } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { AppShell } from '@/components/app-shell';
import { AiUsageCard } from '@/components/ai-usage-card';
import { Section } from '@/components/ui';
import { HomeStats } from '@/components/home-stats';
import { RevenueCalendar } from '@/components/revenue-calendar';
import { HomeTabs } from '@/components/home-tabs';
import { tabCua } from '@/lib/tab-trang';
import { HOME_TABS as TABS, HOME_TAB_MAC_DINH, HOME_TABS_COOKIE, type HomeTab } from '@/lib/home-tabs';
import { LenhMt5 } from '@/components/trang-chu/lenh-mt5';
import { theSoChinh } from '@/components/trang-chu/so-chinh';
import { docDuAn, docNguPhu, docThuTheoNgay, kyPhu } from '@/lib/home/du-lieu';
import { PhuCanChuY, PhuView } from '@/components/phu-view';
import { LuatView } from '@/components/luat-view';
import { TaiSanTab } from '@/components/tai-san-tab';
import { SeoTab } from '@/components/seo-tab';
import { KenhNoiDungTab } from '@/components/kenh-noi-dung-tab';
import { AffiliateOffersPanel } from '@/components/affiliate-offers-panel';
import { DeliverabilityCard } from '@/components/deliverability-card';
import { MailwizzListsPanel } from '@/components/mailwizz-lists-panel';
import { AwarenessFunnelPanel } from '@/components/awareness-funnel-panel';
import { AwinDailyPanel } from '@/components/awin-daily-panel';
import { DuAnLuoi } from '@/components/trang-chu/du-an';
import { getMode, getAiUsageSummary, type listProjects } from '@/lib/data';
import { ThuVienTab } from '@/components/thu-vien-tab';
import { MayDangView } from '@/components/may-dang-view';
import { MaySxView } from '@/components/may-sx-view';

// Read DB at request time, not build time — server isn't migrated yet on first deploy.
export const dynamic = 'force-dynamic';

// Trang chủ = trung tâm điều hành (anh chốt 16/09/2026): PHỦ (camp · nền tảng · nguồn · hạ tầng) dọn từ
// /p/<id>/phu về đây, phần còn lại của trang chủ cũ (12 panel xếp dọc) chia theo CÂU HỎI: tiền về chưa (Doanh thu),
// mình đang có gì sinh tiền (Tài sản: website · kênh nội dung · shop → sản phẩm), chỉ số nội bộ một site (SEO),
// gửi có tới không (Email), danh sách dự án (Dự án). Trên cùng luôn là
// số tiền + Cần chú ý; mỗi lượt chỉ đọc dữ liệu của tab đang mở. Lệnh MT5 (strategy-lab/orders) cũng về đây (16/09).
// Thứ tự tab: cookie `home-tabs` (kéo-thả ở HomeTabs; nối bằng '.', dấu phẩy không hợp lệ trong cookie-value), thiếu key nào thì key đó xếp cuối theo mặc định.
const cho =<div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>đang đọc…</div>;
const pill = (active: boolean): React.CSSProperties => ({ padding: '3px 9px', fontSize: 11, borderRadius: 999, border: '1px solid var(--line)', textDecoration: 'none', background: 'var(--bg-2)', ...(active ? { borderColor: 'var(--fg-2)', color: 'var(--fg-1)' } : { color: 'var(--fg-3)' }) });

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string; p?: string; days?: string; tv?: string; ky?: string }> }) {
  const sp = await searchParams;
  const tab: HomeTab = TABS.includes(sp.tab as HomeTab) ? (sp.tab as HomeTab) : HOME_TAB_MAC_DINH;
  const thuTu = ((await cookies()).get(HOME_TABS_COOKIE)?.value ?? '').split('.').filter((k): k is HomeTab => TABS.includes(k as HomeTab));
  const xep = <T extends { key: HomeTab }>(items: T[]) => [...items].sort((a, b) => (thuTu.includes(a.key) ? thuTu.indexOf(a.key) : 99 + TABS.indexOf(a.key)) - (thuTu.includes(b.key) ? thuTu.indexOf(b.key) : 99 + TABS.indexOf(b.key)));
  // số tiền + sổ phủ đọc qua lib/home/du-lieu.ts — CÙNG nguồn, CÙNG công thức với các widget của /home (components/home/ve.tsx)
  const days = kyPhu(sp.days);
  const [projects, mode, byDay, ngu] = await Promise.all([docDuAn(), getMode('affiliate'), docThuTheoNgay(30), docNguPhu(sp.p, days)]);
  const { duAnPhu: phuProjects, pid, phu, host } = ngu;
  const { the, campChay, hong } = theSoChinh({ byDay, phu, pid, days, soDuAn: projects.length });
  const laPhu = tab === 'camp' || tab === 'phu' || tab === 'nguon' || tab === 'hatang';
  const qs = (kv: Record<string, string | number>) => '/?' + new URLSearchParams({ tab, p: pid ?? '', days: String(days), ...Object.fromEntries(Object.entries(kv).map(([k, v]) => [k, String(v)])) }).toString();

  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <HomeStats cards={the} />
        {/* Cần chú ý = việc của campaign (adapter, lander, camp tới ngưỡng, sid lạ) → chỉ hiện ở 4 tab campaign (#1110, 05/10/2026:
            hiện ở mọi tab là đè lên việc đang làm). Tab khác vẫn thấy dấu đỏ trên tab "Lander & adapter". */}
        {phu && laPhu && <Suspense fallback={null}><PhuCanChuY data={phu} /></Suspense>}

        <div>
          <Suspense fallback={null}>
            <HomeTabs items={xep(tabCua<HomeTab>('/', {
              camp: campChay || undefined,
              phu: phu?.platforms.length || undefined,
              nguon: phu?.nguon.filter((x) => x.trangThai === 'hoat_dong').length || undefined,
              hatang: hong ? <span style={{ color: 'var(--danger)' }}>{hong} đỏ</span> : undefined,
              duan: projects.length,
            }))} right={laPhu ? (
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {phuProjects.length > 1 && phuProjects.map((p) => <Link key={p} href={qs({ p })} style={pill(p === pid)}>{p}</Link>)}
                {phuProjects.length > 1 && <span style={{ color: 'var(--line)' }}>|</span>}
                {[7, 30, 90].map((n) => <Link key={n} href={qs({ days: n })} style={pill(n === days)}>{n} ngày</Link>)}
              </span>
            ) : undefined} />
          </Suspense>

          {laPhu && (phu && pid ? <PhuView data={phu} projectId={pid} host={host} phan={tab} />
            : <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa project nào có sổ phủ — adapter (scripts/phu/*.mjs) hoặc /api/phu/ingest khai vào là hiện.</div>)}

          {tab === 'doanhthu' && <>
            <Section title="💵 Doanh thu · mọi nguồn" subtitle="30 ngày gần nhất" static
              headerRight={<Link href="/revenue" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Lịch chi tiết →</Link>}>
              <RevenueCalendar rows={byDay.rows} errors={byDay.errors} scannedNetworks={byDay.scannedNetworks} foldCalendar />
            </Section>
            <AffiliateOffersPanel />
            <AwinDailyPanel />
            <AwarenessFunnelPanel />
          </>}

          {tab === 'taisan' && <Suspense fallback={cho}><TaiSanTab ky={sp.ky} /></Suspense>}
          {tab === 'kenh' && <Suspense fallback={cho}><KenhNoiDungTab ky={sp.ky} /></Suspense>}
          {tab === 'seo' && <Suspense fallback={cho}><SeoTab /></Suspense>}

          {tab === 'email' && <>
            <Suspense fallback={cho}><MailwizzListsPanel /></Suspense>
            <DeliverabilityCard />
          </>}

          {tab === 'luat' && <LuatView />}
          {tab === 'lenh' && <LenhMt5 />}
          {tab === 'duan' && <DuAn projects={projects} />}
          {tab === 'social' && <Suspense fallback={cho}><SocialKhoi /></Suspense>}
          {tab === 'maydang' && <Suspense fallback={cho}><MayDangView /></Suspense>}
          {tab === 'maysx' && <Suspense fallback={cho}><MaySxView /></Suspense>}
          {tab === 'thuvien' && <Suspense fallback={cho}><ThuVienTab tv={sp.tv} /></Suspense>}
          {tab === 'ethopex' && <Suspense fallback={cho}><EthopexKhoi /></Suspense>}
        </div>
      </div>
    </AppShell>
  );
}

async function DuAn({ projects }: { projects: Awaited<ReturnType<typeof listProjects>> }) {
  const aiUsage = await getAiUsageSummary();
  return (
    <div>
      <DuAnLuoi projects={projects} />
      <AiUsageCard usage={aiUsage} />
    </div>
  );
}
