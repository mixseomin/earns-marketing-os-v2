import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { InboxPage } from '@/components/inbox-page';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listInbox } from '@/lib/actions/inbox';
import { listTeamMembers, getCurrentUserId } from '@/lib/actions/team';

export const dynamic = 'force-dynamic';

export default async function ProjectInboxRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assign?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  const currentUserId = await getCurrentUserId();
  const assignment: 'all' | 'mine' | 'unassigned' | number =
    sp.assign === 'mine' ? 'mine' :
    sp.assign === 'unassigned' ? 'unassigned' :
    sp.assign && !isNaN(Number(sp.assign)) ? Number(sp.assign) :
    'all';

  const [mode, projects, tasks, teamMembers] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listInbox('all', id, { assignment, currentUserId: currentUserId ?? undefined }),
    listTeamMembers(),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects}>
      <InboxPage tasks={tasks} teamMembers={teamMembers} currentUserId={currentUserId} />
    </AppShell>
  );
}
