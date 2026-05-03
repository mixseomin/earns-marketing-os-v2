import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { InboxPage } from '@/components/inbox-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listInbox } from '@/lib/actions/inbox';
import { listTeamMembers } from '@/lib/actions/team';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function InboxRoute({ searchParams }: { searchParams: Promise<{ assign?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/inbox');

  const params = await searchParams;
  const assignParam = params.assign;
  // Operators are forced to 'mine' filter — can't view others' inboxes
  const assignment: 'all' | 'mine' | 'unassigned' | number =
    me.role === 'operator' ? 'mine' :
    assignParam === 'mine' ? 'mine' :
    assignParam === 'unassigned' ? 'unassigned' :
    assignParam && !isNaN(Number(assignParam)) ? Number(assignParam) :
    'all';

  const [projects, lastProject, fallbackMode, tasks, teamMembers] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listInbox('all', undefined, { assignment, currentUserId: me.id }),
    me.role === 'admin' ? listTeamMembers() : Promise.resolve([]),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <InboxPage tasks={tasks} teamMembers={teamMembers} currentUserId={me.id} />
    </AppShell>
  );
}
