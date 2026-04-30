import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ContentStudioPage } from '@/components/content-studio';
import { ContentStudioReal } from '@/components/content-studio-real';
import { getProject, getProjectMode, listProjects, listContentPieces, listTribes, listAccounts } from '@/lib/data';
import { listSkills } from '@/lib/actions/library';

export const dynamic = 'force-dynamic';

export default async function StudioRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const isDemo = project.isDemo === true;

  const [mode, projects, pieces, skills, tribes, accounts] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    isDemo ? Promise.resolve([]) : listContentPieces(id),
    isDemo ? Promise.resolve([]) : listSkills(),
    isDemo ? Promise.resolve([]) : listTribes(id),
    isDemo ? Promise.resolve([]) : listAccounts(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="studio">
      {isDemo ? (
        <ContentStudioPage />
      ) : (
        <ContentStudioReal
          items={pieces}
          projectId={id}
          projectName={project.name}
          skills={skills}
          tribes={tribes.map((t) => ({ slug: t.slug, name: t.name }))}
          accounts={accounts.filter((a) => a.handle).map((a) => ({ handle: a.handle!, platformKey: a.platformKey }))}
        />
      )}
    </AppShell>
  );
}
