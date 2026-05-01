import { AppShell } from '@/components/app-shell';
import { SchedulerPage } from '@/components/scheduler-page';
import { listCronJobs } from '@/lib/scheduler';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function SchedulerRoute() {
  const [projects, lastProject, fallbackMode, jobs] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listCronJobs(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <SchedulerPage jobs={jobs} />
    </AppShell>
  );
}
