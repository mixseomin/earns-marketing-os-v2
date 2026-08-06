import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { OpportunitiesPage } from '@/components/opportunities-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listMarketBenchmarks, listIdeaAnalyses } from '@/lib/opportunities/data';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/opportunities');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, benchmarks, ideas] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listMarketBenchmarks(),
    listIdeaAnalyses(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <OpportunitiesPage benchmarks={benchmarks} ideas={ideas} />
    </AppShell>
  );
}
