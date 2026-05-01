import { AppShell } from '@/components/app-shell';
import { InboxPage } from '@/components/inbox-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listInbox } from '@/lib/actions/inbox';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function InboxRoute() {
  const [projects, lastProject, fallbackMode, tasks] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listInbox('all'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <InboxPage tasks={tasks} />
    </AppShell>
  );
}
