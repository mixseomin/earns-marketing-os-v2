import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { InboxPage } from '@/components/inbox-page';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listInbox } from '@/lib/actions/inbox';
import { listTeamMembers } from '@/lib/actions/team';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProjectInboxRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assign?: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/inbox`);

  const sp = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  const assignment: 'all' | 'mine' | 'unassigned' | number =
    me.role === 'operator' ? 'mine' :
    sp.assign === 'mine' ? 'mine' :
    sp.assign === 'unassigned' ? 'unassigned' :
    sp.assign && !isNaN(Number(sp.assign)) ? Number(sp.assign) :
    'all';

  const [mode, projects, tasks, teamMembers] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listInbox('all', id, { assignment, currentUserId: me.id }),
    me.role === 'admin' ? listTeamMembers() : Promise.resolve([]),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects}
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <InboxPage tasks={tasks} teamMembers={teamMembers} currentUserId={me.id} />
    </AppShell>
  );
}
