import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { RevenueView } from '@/components/revenue-view';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getAdsenseSummary } from '@/lib/adsense/reports';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function RevenueRoute({ searchParams }: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = Math.max(7, Math.min(90, parseInt(sp.days ?? '30') || 30));
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/revenue');
  const [projects, lastProject, fallbackMode, summary] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    getAdsenseSummary({ windowDays: days }),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;
  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <RevenueView summary={summary} scope="all" />
    </AppShell>
  );
}
