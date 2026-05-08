import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { TribesPage } from '@/components/tribes-page';
import { TribesRealPage } from '@/components/tribes-real-page';
import { getProject, getProjectMode, listProjects, listTribes, listHabitats, listPlatforms } from '@/lib/data';
import { countAccountsPerTribe } from '@/lib/actions/community-briefs';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function TribesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const isDemo = project.isDemo === true;

  // Demo: render mock TribesPage from MOS2 design.
  // Real: pull DB tribes + habitats; render real view.
  const [mode, projects, tribes, habitats, platforms, briefCounts] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    isDemo ? Promise.resolve([]) : listTribes(id),
    isDemo ? Promise.resolve([]) : listHabitats(id),
    listPlatforms(),
    isDemo ? Promise.resolve({ byTribe: {}, byHabitat: {}, allHabitats: 0, untrackedTribe: 0 }) : countAccountsPerTribe(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="tribes" currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      {isDemo
        ? <TribesPage />
        : <TribesRealPage projectId={id} project={project} tribes={tribes} habitats={habitats} platforms={platforms} briefCounts={briefCounts} projectName={project.name} />}
    </AppShell>
  );
}
