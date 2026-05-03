import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PlatformsPage } from '@/components/platforms-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listPlatformsWithUsage } from '@/lib/actions/platforms';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function PlatformsRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/platforms');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, platforms] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listPlatformsWithUsage(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <PlatformsPage platforms={platforms} />
    </AppShell>
  );
}
