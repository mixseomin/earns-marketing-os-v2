import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SeedingCockpit } from '@/components/seeding-cockpit';
import { getProject, getProjectMode, listProjects, listTribes, listPlatforms } from '@/lib/data';
import { listSeedingQueue } from '@/lib/actions/seeding';
import {
  listRecentPostedCards,
  listAllPostedCards,
  getPostedFilterOptions,
  type AllPostedFilters,
} from '@/lib/actions/brief-posts';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_ALL_FILTERS: AllPostedFilters = {
  days: 7, hideRemoved: true, sort: 'posted_desc', limit: 50, offset: 0,
};

export default async function SeedingRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const [mode, projects, queue, tribes, platforms, recentPosted, postedOptions, postedInitial] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listSeedingQueue(id),
    listTribes(id),
    listPlatforms(),
    listRecentPostedCards(id, { days: 7, limit: 50 }),
    getPostedFilterOptions(id),
    listAllPostedCards(id, DEFAULT_ALL_FILTERS),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="seeding"
              currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <SeedingCockpit projectId={id} projectName={project.name} project={project}
                      platforms={platforms} queue={queue} tribes={tribes}
                      recentPosted={recentPosted}
                      postedOptions={postedOptions}
                      postedInitial={postedInitial}
                      postedInitialFilters={DEFAULT_ALL_FILTERS} />
    </AppShell>
  );
}
