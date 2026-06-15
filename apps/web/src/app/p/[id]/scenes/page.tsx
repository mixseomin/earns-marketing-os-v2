import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ScenesPage } from '@/components/scenes-page';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listProjectScenePeople } from '@/lib/actions/scene-people';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ScenesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const isDemo = project.isDemo === true;
  const [mode, projects, people] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    isDemo ? Promise.resolve([]) : listProjectScenePeople(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="scenes" currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <ScenesPage projectId={id} people={people} />
    </AppShell>
  );
}
