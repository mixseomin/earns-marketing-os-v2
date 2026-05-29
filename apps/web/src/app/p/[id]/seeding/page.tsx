import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SeedingCockpit } from '@/components/seeding-cockpit';
import { getProject, getProjectMode, listProjects, listTribes, listPlatforms, listHabitats, listAccounts } from '@/lib/data';
import { listSeedingQueue } from '@/lib/actions/seeding';
import {
  listRecentPostedCards,
  listAllPostedCards,
  getPostedFilterOptions,
} from '@/lib/actions/brief-posts';
import { getCurrentUser } from '@/lib/auth';
import { parseSeedingTabUrl } from '@/lib/posts-tab-url';

export const dynamic = 'force-dynamic';

export default async function SeedingRoute({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const { view, filters: initialFilters } = parseSeedingTabUrl(sp);

  const [mode, projects, queue, tribes, platforms, habitats, accounts, recentPosted, postedOptions, postedInitial] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listSeedingQueue(id),
    listTribes(id),
    listPlatforms(),
    listHabitats(id),
    listAccounts(id),
    listRecentPostedCards(id, { days: 7, limit: 50 }),
    getPostedFilterOptions(id),
    listAllPostedCards(id, initialFilters),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="seeding"
              currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <SeedingCockpit projectId={id} projectName={project.name} project={project}
                      platforms={platforms} queue={queue} tribes={tribes}
                      habitats={habitats}
                      accounts={accounts}
                      recentPosted={recentPosted}
                      initialView={view}
                      postedOptions={postedOptions}
                      postedInitial={postedInitial}
                      postedInitialFilters={initialFilters} />
    </AppShell>
  );
}
