import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { InboxPage } from '@/components/inbox-page';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listInbox } from '@/lib/actions/inbox';

export const dynamic = 'force-dynamic';

export default async function ProjectInboxRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [mode, projects, tasks] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listInbox('all', id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects}>
      <InboxPage tasks={tasks} />
    </AppShell>
  );
}
