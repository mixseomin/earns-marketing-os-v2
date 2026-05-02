import { AppShell } from '@/components/app-shell';
import { InboxPage } from '@/components/inbox-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listInbox } from '@/lib/actions/inbox';
import { listTeamMembers, getCurrentUserId } from '@/lib/actions/team';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function InboxRoute({ searchParams }: { searchParams: Promise<{ assign?: string }> }) {
  const params = await searchParams;
  const assignParam = params.assign;
  const currentUserId = await getCurrentUserId();
  const assignment: 'all' | 'mine' | 'unassigned' | number =
    assignParam === 'mine' ? 'mine' :
    assignParam === 'unassigned' ? 'unassigned' :
    assignParam && !isNaN(Number(assignParam)) ? Number(assignParam) :
    'all';

  const [projects, lastProject, fallbackMode, tasks, teamMembers] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listInbox('all', undefined, { assignment, currentUserId: currentUserId ?? undefined }),
    listTeamMembers(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <InboxPage tasks={tasks} teamMembers={teamMembers} currentUserId={currentUserId} />
    </AppShell>
  );
}
