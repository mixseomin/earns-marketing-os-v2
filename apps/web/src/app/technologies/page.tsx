import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { TechnologiesPage } from '@/components/technologies-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listTechnologiesWithUsage } from '@/lib/actions/technologies';
import { findDuplicateSelectors } from '@/lib/actions/habitat-selectors';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function TechnologiesRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/technologies');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, technologies, dups] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listTechnologiesWithUsage(),
    findDuplicateSelectors({ scopeKind: 'technology' }),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <TechnologiesPage technologies={technologies} dups={dups} />
    </AppShell>
  );
}
