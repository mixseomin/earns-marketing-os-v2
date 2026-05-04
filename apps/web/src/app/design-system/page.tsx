import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { DesignSystemPlayground } from '@/components/design-system-playground';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function DesignSystemRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/design-system');
  if (me.role !== 'admin') redirect('/?error=design-admin-only');

  const [projects, lastProject, fallbackMode] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <DesignSystemPlayground />
    </AppShell>
  );
}
