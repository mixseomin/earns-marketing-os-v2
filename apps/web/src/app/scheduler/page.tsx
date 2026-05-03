import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SchedulerPage } from '@/components/scheduler-page';
import { listCronJobs } from '@/lib/scheduler';
import { listWorkerNodes } from '@/lib/actions/scheduler';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function SchedulerRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/scheduler');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, jobs, nodes] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listCronJobs(),
    listWorkerNodes(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <SchedulerPage jobs={jobs} nodes={nodes} />
    </AppShell>
  );
}
