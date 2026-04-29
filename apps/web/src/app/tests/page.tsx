import { AppShell } from '@/components/app-shell';
import { TestsPage } from '@/components/tests-page';
import { listProjects, listUseCases, getMode } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function TestsRoute() {
  const [projects, cases, mode] = await Promise.all([
    listProjects(),
    listUseCases(),
    getMode('affiliate'),
  ]);

  // Tests is global (cross-project). Use isPortfolio so the topbar
  // doesn't render project-specific tabs and Sidebar's currentProjectId is undefined.
  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <TestsPage cases={cases} />
    </AppShell>
  );
}
