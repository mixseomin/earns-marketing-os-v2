import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PillarsPage } from '@/components/pillars-page';
import { getProject, getProjectMode, listProjects, listTribes } from '@/lib/data';
import { listContentPillars } from '@/lib/actions/content-pillars';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PillarsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const [mode, projects, pillars, tribes] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listContentPillars(id),
    listTribes(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="pillars"
              currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <PillarsPage projectId={id} pillars={pillars} tribes={tribes} />
    </AppShell>
  );
}
