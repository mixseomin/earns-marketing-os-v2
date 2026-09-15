import { Suspense } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { AppShell } from '@/components/app-shell';
import { AiUsageCard } from '@/components/ai-usage-card';
import { Section, StatsStrip } from '@/components/ui';
import { RevenueCalendar } from '@/components/revenue-calendar';
import { HomeTabs } from '@/components/home-tabs';
import { HOME_TABS as TABS, HOME_TAB_MAC_DINH, HOME_TABS_COOKIE, type HomeTab } from '@/lib/home-tabs';
import { OrdersBlotter } from '@/components/orders-blotter';
import { PhuCanChuY, PhuView } from '@/components/phu-view';
import { SeoSitesPanel } from '@/components/seo-sites-panel';
import { ProductsPanel } from '@/components/products-panel';
import { SteamsoloLangPanel } from '@/components/steamsolo-lang-panel';
import { AffiliateOffersPanel } from '@/components/affiliate-offers-panel';
import { DeliverabilityCard } from '@/components/deliverability-card';
import { MailwizzListsPanel } from '@/components/mailwizz-lists-panel';
import { AwarenessFunnelPanel } from '@/components/awareness-funnel-panel';
import { AwinDailyPanel } from '@/components/awin-daily-panel';
import { PortfolioGrid } from '@/components/portfolio-grid';
import { getMode, listProjects, getAiUsageSummary, listStrategyTrades, listStrategyTests, listStrategyForward, getBrokerNowMs } from '@/lib/data';
import { getRevenueByDay } from '@/lib/revenue/by-day';
import { getPhu, listPhuProjects } from '@/lib/phu';
import { BACKLINK_SITES } from '@/lib/backlink-sites';

// Read DB at request time, not build time — server isn't migrated yet on first deploy.
export const dynamic = 'force-dynamic';

// Trang chủ = trung tâm điều hành (anh chốt 16/09/2026): PHỦ (camp · nền tảng · nguồn · hạ tầng) dọn từ
// /p/<id>/phu về đây, phần còn lại của trang chủ cũ (12 panel xếp dọc) chia theo CÂU HỎI: tiền về chưa (Doanh thu),
// có ai đi ngang không (SEO & sản phẩm), gửi có tới không (Email), danh sách dự án (Dự án). Trên cùng luôn là
// số tiền + Cần chú ý; mỗi lượt chỉ đọc dữ liệu của tab đang mở. Lệnh MT5 (strategy-lab/orders) cũng về đây (16/09).
// Thứ tự tab: cookie `home-tabs` (kéo-thả ở HomeTabs; nối bằng '.', dấu phẩy không hợp lệ trong cookie-value), thiếu key nào thì key đó xếp cuối theo mặc định.
const SL = 'strategy-lab';
const usd = (v: number) => (v ? `$${v.toFixed(2)}` : '—');
const cho = <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>đang đọc…</div>;
const pill = (active: boolean): React.CSSProperties => ({ padding: '3px 9px', fontSize: 11, borderRadius: 999, border: '1px solid var(--line)', textDecoration: 'none', background: 'var(--bg-2)', ...(active ? { borderColor: 'var(--fg-2)', color: 'var(--fg-1)' } : { color: 'var(--fg-3)' }) });

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string; p?: string; days?: string }> }) {
  const sp = await searchParams;
  const tab: HomeTab = TABS.includes(sp.tab as HomeTab) ? (sp.tab as HomeTab) : HOME_TAB_MAC_DINH;
  const thuTu = ((await cookies()).get(HOME_TABS_COOKIE)?.value ?? '').split('.').filter((k): k is HomeTab => TABS.includes(k as HomeTab));
  const xep = <T extends { key: HomeTab }>(items: T[]) => [...items].sort((a, b) => (thuTu.includes(a.key) ? thuTu.indexOf(a.key) : 99 + TABS.indexOf(a.key)) - (thuTu.includes(b.key) ? thuTu.indexOf(b.key) : 99 + TABS.indexOf(b.key)));
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const [projects, mode, byDay, phuProjects] = await Promise.all([listProjects(), getMode('affiliate'), getRevenueByDay(30), listPhuProjects()]);
  const pid = phuProjects.includes(sp.p ?? '') ? String(sp.p) : phuProjects[0];
  const phu = pid ? await getPhu(pid, days) : null;
  const host = phu?.landers[0]?.host.replace(/^[a-z]+\./, '') ?? BACKLINK_SITES.find((s) => s.slug === pid)?.domain ?? '';
  const thu30 = byDay.rows.reduce((a, r) => a + r.amount, 0);
  const campChay = phu?.camp.filter((c) => c.trangThai === 'chay').length ?? 0;
  const cuHon = (iso: string | null, phut: number) => !iso || Date.now() - new Date(iso).getTime() > phut * 60_000;
  const hong = phu ? phu.adapters.filter((a) => a.lastOk === false || (a.loai === 'cron' && cuHon(a.lastRun, 24 * 60))).length + phu.landers.filter((l) => l.trangThai !== 'song' || cuHon(l.lastSinh, 20)).length : 0;
  const pct = (a: number, b: number, so = 0) => (b ? `${((a / b) * 100).toFixed(so)}%` : '—');
  const laPhu = tab === 'camp' || tab === 'phu' || tab === 'nguon' || tab === 'hatang';
  const qs = (kv: Record<string, string | number>) => '/?' + new URLSearchParams({ tab, p: pid ?? '', days: String(days), ...Object.fromEntries(Object.entries(kv).map(([k, v]) => [k, String(v)])) }).toString();

  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <div style={{ display: 'grid', gap: 14 }}>
        <StatsStrip minColWidth={150} cards={[
          { key: 'thu', label: 'Doanh thu 30 ngày', value: usd(thu30), sub: byDay.errors.length ? <span style={{ color: 'var(--danger)' }}>{byDay.errors.length} nguồn lỗi</span> : `${byDay.scannedNetworks.length} mạng đã quét` },
          { key: 'chi', label: `Chi QC ${days} ngày`, value: usd(phu?.tong.chi ?? 0), color: phu && phu.tong.chi > phu.tong.revenue ? 'var(--danger)' : undefined, sub: phu ? `về ${usd(phu.tong.revenue)} · ${pid}` : 'chưa có sổ phủ' },
          { key: 'pheu', label: 'View → click → out', value: phu ? `${phu.tong.view} → ${phu.tong.click} → ${phu.tong.out}` : '—', sub: phu ? `CTR ${pct(phu.tong.click, phu.tong.view, 1)} · cổng ${pct(phu.tong.gate, phu.tong.view)}` : undefined },
          { key: 'signup', label: 'Signup', value: phu?.tong.signup ?? '—', sub: phu?.tong.click ? `${((phu.tong.signup / phu.tong.click) * 1000).toFixed(1)} / 1k click` : undefined },
          { key: 'camp', label: 'Camp chạy', value: campChay, color: hong ? 'var(--danger)' : undefined, sub: hong ? `${hong} adapter/lander đỏ` : `${projects.length} dự án` },
        ]} />
        {phu && <PhuCanChuY data={phu} />}

        <div>
          <Suspense fallback={null}>
            <HomeTabs items={xep([
              { key: 'camp', label: 'Campaign', badge: campChay || undefined, title: 'Mỗi dòng = một campaign: phễu + tiêu chí → phán xét' },
              { key: 'phu', label: 'Nền tảng phủ', badge: phu?.platforms.length || undefined },
              { key: 'nguon', label: 'Nguồn traffic', badge: phu?.nguon.filter((x) => x.trangThai === 'hoat_dong').length || undefined },
              { key: 'hatang', label: 'Lander & adapter', badge: hong ? <span style={{ color: 'var(--danger)' }}>{hong} đỏ</span> : undefined },
              { key: 'lenh', label: 'Lệnh MT5', title: 'Live Orders — forward-test mọi strategy (strategy-lab)' },
              { key: 'doanhthu', label: 'Doanh thu', title: 'Lịch tiền mọi nguồn · affiliate · Awin' },
              { key: 'seo', label: 'SEO & sản phẩm', title: 'GSC · Gumroad · SteamSolo' },
              { key: 'email', label: 'Email', title: 'MailWizz · deliverability' },
              { key: 'duan', label: 'Dự án', badge: projects.length },
            ])} right={laPhu ? (
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

          {tab === 'seo' && <>
            <SeoSitesPanel />
            <Suspense fallback={cho}><ProductsPanel /></Suspense>
            <SteamsoloLangPanel />
          </>}

          {tab === 'email' && <>
            <Suspense fallback={cho}><MailwizzListsPanel /></Suspense>
            <DeliverabilityCard />
          </>}

          {tab === 'lenh' && <Lenh />}
          {tab === 'duan' && <DuAn projects={projects} />}
        </div>
      </div>
    </AppShell>
  );
}

// Live Orders của strategy-lab — cùng blotter với /p/strategy-lab/orders, bộ lọc giữ ở cookie slf2 như bên đó.
async function Lenh() {
  let initial = { range: '24h', grouped: true, hideClosed: false, sort: 'equity' };
  try { const slf = (await cookies()).get('slf2')?.value; if (slf) initial = { ...initial, ...JSON.parse(decodeURIComponent(slf)) }; } catch { /* cookie hỏng thì dùng mặc định */ }
  const [trades, tests, forward, brokerNowMs] = await Promise.all([listStrategyTrades(), listStrategyTests(SL), listStrategyForward(), getBrokerNowMs()]);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Link href={`/p/${SL}/strategy-tests`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>🔬 Strategy Tests →</Link>
      </div>
      <OrdersBlotter trades={trades} tests={tests} forward={forward} brokerNowMs={brokerNowMs} initial={initial} />
    </div>
  );
}

async function DuAn({ projects }: { projects: Awaited<ReturnType<typeof listProjects>> }) {
  const aiUsage = await getAiUsageSummary();
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Link href="/p/new" style={{ background: 'var(--accent)', color: 'var(--bg-0)', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>+ New Project</Link>
      </div>
      <PortfolioGrid projects={projects} totalBudget={projects.reduce((s, p) => s + p.budget, 0)} />
      <AiUsageCard usage={aiUsage} />
    </div>
  );
}
