import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BacklinksPage } from '@/components/backlinks-page';
import { getProject, getProjectMode, listProjects, listPlatforms, listAccounts, listMedia } from '@/lib/data';
import { listTeamMembers } from '@/lib/actions/team';
import { listProxies, listBrowserProfiles, listProjectsWithBrowser } from '@/lib/actions/environments';
import { getCurrentUser } from '@/lib/auth';
import { getBacklinkTasks } from '@/lib/actions/backlink-tasks';
import { listFollowups } from '@/lib/actions/followups';
import { listScheduledContentPieces } from '@/lib/data';
import { listBuildingProducts } from '@/lib/actions/products-building';
import { listSourceIntel } from '@/lib/actions/backlink-catalog';
import { PREFS_COOKIE, parsePrefs } from '@/lib/prefs';
import { todayInAppTz } from '@/lib/local-day';
import { resolveSiteSlug, BACKLINK_SITES } from '@/lib/backlink-sites';

export const dynamic = 'force-dynamic';

// "Plays" = the SAME surface as /backlinks (real list/calendar/filters + the real task
// drawer with its built-in Outreach chip), just opened Kanban-first. One place to see /
// assign / follow every distribution play. No reinvented UI — reuses BacklinksPage whole.
export default async function PlaysRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Lựa chọn giao diện đã nhớ — đọc SERVER-SIDE để lần paint đầu đã đúng view/lịch, không nháy.
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);

  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const slug = resolveSiteSlug(id) ?? id;   // any project can hold plays; fall back to project id as the site_status key
  const siteLabel = BACKLINK_SITES.find((s) => s.slug === slug)?.label ?? project.name;
  const [mode, projects, tasks, followups, pieces, platforms, accounts, teamMembers, proxies, browserProfiles, media, sourceIntel, browserReady, products] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    getBacklinkTasks(id),
    listFollowups(id),
    listScheduledContentPieces(id),
    listPlatforms(),
    listAccounts(id),
    listTeamMembers(),
    listProxies(),
    listBrowserProfiles(),
    listMedia(id),
    listSourceIntel(),
    listProjectsWithBrowser(),
    listBuildingProducts(id),
  ]);

  return (
    <AppShell
      mode={mode}
      project={project}
      projects={projects}
      tab="plays"
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
    >
      <BacklinksPage prefs={prefs} today={todayInAppTz()} products={products} projectId={id} slug={slug} siteLabel={siteLabel} tasks={tasks} followups={followups} pieces={pieces}
        project={project} platforms={platforms} accounts={accounts}
        teamMembers={teamMembers} proxies={proxies} browserProfiles={browserProfiles} media={media} sourceIntel={sourceIntel} browserReady={browserReady} initialView="kanban" />
    </AppShell>
  );
}
