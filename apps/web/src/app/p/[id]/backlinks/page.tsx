import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BacklinksPage } from '@/components/backlinks-page';
import { getProject, getProjectMode, listProjects, listPlatforms, listAccounts, listMedia } from '@/lib/data';
import { listTeamMembers } from '@/lib/actions/team';
import { listProxies, listBrowserProfiles } from '@/lib/actions/environments';
import { getCurrentUser } from '@/lib/auth';
import { getBacklinkTasks } from '@/lib/actions/backlink-tasks';
import { resolveSiteSlug, BACKLINK_SITES } from '@/lib/backlink-sites';

export const dynamic = 'force-dynamic';

export default async function BacklinksRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const slug = resolveSiteSlug(id);
  const siteLabel = BACKLINK_SITES.find((s) => s.slug === slug)?.label ?? project.name;
  const [mode, projects, tasks, platforms, accounts, teamMembers, proxies, browserProfiles, media] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    slug ? getBacklinkTasks(id) : Promise.resolve([]),
    listPlatforms(),
    listAccounts(id),
    listTeamMembers(),
    listProxies(),
    listBrowserProfiles(),
    listMedia(id),
  ]);

  return (
    <AppShell
      mode={mode}
      project={project}
      projects={projects}
      tab="backlinks"
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
    >
      <BacklinksPage projectId={id} slug={slug} siteLabel={siteLabel} tasks={tasks}
        project={project} platforms={platforms} accounts={accounts}
        teamMembers={teamMembers} proxies={proxies} browserProfiles={browserProfiles} media={media} />
    </AppShell>
  );
}
