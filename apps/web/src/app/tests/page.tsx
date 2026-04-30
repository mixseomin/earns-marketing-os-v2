import { AppShell } from '@/components/app-shell';
import { TestsPage } from '@/components/tests-page';
import { listProjects, listUseCases, getMode, getProjectMode } from '@/lib/data';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function TestsRoute() {
  const [projects, cases, lastProject, fallbackMode] = await Promise.all([
    listProjects(),
    listUseCases(),
    getLastProject(),
    getMode('affiliate'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  // Tests is global (cross-project). isPortfolio=true keeps topbar in portfolio mode.
  // project={lastProject} preserves Sidebar/ProjectSwitcher visual context.
  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <TestsPage cases={cases} />
    </AppShell>
  );
}
