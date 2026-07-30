import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PlaysPage } from '@/components/plays-page';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listInbox } from '@/lib/actions/inbox';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Unified per-project "Plays" board. Every distribution task for this site lives in
// human_tasks (backlink = platform_key 'backlink', community/reddit/etc = their keys);
// the Backlinks/Inbox tabs are just filtered views on the same table. This tab drops
// the platform_key filter and shows ALL statuses (incl. backlog) in one place.
export default async function PlaysRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const [mode, projects, tasks] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listInbox('all', id, { assignment: 'all', limit: 1000 }),
  ]);

  return (
    <AppShell
      mode={mode}
      project={project}
      projects={projects}
      tab="plays"
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
    >
      <PlaysPage projectId={id} tasks={tasks} />
    </AppShell>
  );
}
