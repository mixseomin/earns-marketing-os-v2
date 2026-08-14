import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PortfolioView } from '@/components/portfolio-view';
import { AiUsageCard } from '@/components/ai-usage-card';
import { Section } from '@/components/ui';
import { RevenueCalendar } from '@/components/revenue-calendar';
import { getMode, listProjects, getAiUsageSummary } from '@/lib/data';
import { getRevenueByDay } from '@/lib/revenue/by-day';

// Read DB at request time, not build time — server isn't migrated yet on first deploy.
export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const [projects, mode, aiUsage, byDay] = await Promise.all([
    listProjects(), getMode('affiliate'), getAiUsageSummary(), getRevenueByDay(30),
  ]);
  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <AiUsageCard usage={aiUsage} />

      {/* Compact all-sources revenue glance — the money number up front, before Portfolio.
          Full per-day calendar + funnel live on /revenue (linked). */}
      <Section
        title="💵 Doanh thu · mọi nguồn"
        subtitle="30 ngày gần nhất"
        headerRight={<Link href="/revenue" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Lịch chi tiết →</Link>}
      >
        <RevenueCalendar rows={byDay.rows} errors={byDay.errors} scannedNetworks={byDay.scannedNetworks} foldCalendar />
      </Section>

      <PortfolioView projects={projects} />
    </AppShell>
  );
}
