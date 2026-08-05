import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { RevenueView } from '@/components/revenue-view';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getAdsenseSummary } from '@/lib/adsense/reports';
import { getGumroadSummary } from '@/lib/gumroad/products';
import { getRevenueByDay, parseRange, ALL_DAYS } from '@/lib/revenue/by-day';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function RevenueRoute({ searchParams }: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = parseRange(sp.days);
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/revenue');
  const [projects, lastProject, fallbackMode, summary, gumroad, byDay] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    getAdsenseSummary({ windowDays: days }),
    getGumroadSummary(),
    getRevenueByDay(days || ALL_DAYS),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;
  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <RevenueView summary={summary} scope="all" gumroad={gumroad} byDay={byDay} days={days} />
    </AppShell>
  );
}
