import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ContentStudioPage } from '@/components/content-studio';
import { ContentStudioReal } from '@/components/content-studio-real';
import { getProject, getProjectMode, listProjects, listContentPieces } from '@/lib/data';
import { listSkills } from '@/lib/actions/library';

export const dynamic = 'force-dynamic';

export default async function StudioRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const isDemo = project.isDemo === true;

  const [mode, projects, pieces, skills] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    isDemo ? Promise.resolve([]) : listContentPieces(id),
    isDemo ? Promise.resolve([]) : listSkills(),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="studio">
      {isDemo ? (
        <ContentStudioPage />
      ) : (
        <ContentStudioReal items={pieces} projectId={id} projectName={project.name} skills={skills} />
      )}
    </AppShell>
  );
}
