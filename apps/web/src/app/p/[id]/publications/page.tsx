import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PublicationsPage } from '@/components/publications-page';
import { listPublications } from '@/lib/actions/publications';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PublicationsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const [mode, projects, publications] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listPublications(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <PublicationsPage projectId={id} publications={publications} />
    </AppShell>
  );
}
