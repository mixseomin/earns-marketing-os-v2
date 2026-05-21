import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SeedingCockpit } from '@/components/seeding-cockpit';
import { getProject, getProjectMode, listProjects, listTribes, listPlatforms } from '@/lib/data';
import { listSeedingQueue } from '@/lib/actions/seeding';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SeedingRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const [mode, projects, queue, tribes, platforms] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listSeedingQueue(id),
    listTribes(id),
    listPlatforms(),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="seeding"
              currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <SeedingCockpit projectId={id} projectName={project.name} project={project}
                      platforms={platforms} queue={queue} tribes={tribes} />
    </AppShell>
  );
}
