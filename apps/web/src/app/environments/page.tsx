import { AppShell } from '@/components/app-shell';
import { EnvironmentsPage } from '@/components/environments-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listProxies, listBrowserProfiles } from '@/lib/actions/environments';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function EnvironmentsRoute() {
  const [projects, lastProject, fallbackMode, proxies, profiles] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listProxies(),
    listBrowserProfiles(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <EnvironmentsPage proxies={proxies} profiles={profiles} />
    </AppShell>
  );
}
