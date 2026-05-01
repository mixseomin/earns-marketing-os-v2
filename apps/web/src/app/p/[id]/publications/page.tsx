import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PublicationsPage } from '@/components/publications-page';
import { listPublications } from '@/lib/actions/publications';
import { getProject, getProjectMode, listProjects } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function PublicationsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [mode, projects, publications] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listPublications(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects}>
      <PublicationsPage projectId={id} publications={publications} />
    </AppShell>
  );
}
