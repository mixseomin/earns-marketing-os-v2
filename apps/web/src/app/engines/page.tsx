import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { EnginesPage } from '@/components/engines-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listTechnologiesWithUsage } from '@/lib/actions/technologies';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function EnginesRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/engines');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, engines] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listTechnologiesWithUsage(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <EnginesPage engines={engines} />
    </AppShell>
  );
}
