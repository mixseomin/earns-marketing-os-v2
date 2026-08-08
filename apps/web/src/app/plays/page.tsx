import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BacklinksPage } from '@/components/backlinks-page';
import { getMode, listProjects, listPlatforms, listAccounts, listMedia } from '@/lib/data';
import { listTeamMembers } from '@/lib/actions/team';
import { listProxies, listBrowserProfiles, listProjectsWithBrowser } from '@/lib/actions/environments';
import { getCurrentUser } from '@/lib/auth';
import { listBuildingProducts } from '@/lib/actions/products-building';
import { getAllBacklinkTasks } from '@/lib/actions/backlink-tasks';
import { listFollowups } from '@/lib/actions/followups';
import { listSourceIntel } from '@/lib/actions/backlink-catalog';
import { PREFS_COOKIE, parsePrefs } from '@/lib/prefs';
import { resolveSiteSlug } from '@/lib/backlink-sites';

export const dynamic = 'force-dynamic';

// Global "Plays" — every backlink-tracked project's plays in ONE surface. Reuses BacklinksPage whole in
// allProjects mode (same list / Kanban / Calendar / task drawer); each row carries its own project so
// status changes + the drawer act on the right site. Per-project actions (Seed/Generate/account-readiness)
// are hidden here — those stay on /p/[id]/plays. See getAllBacklinkTasks.
export default async function GlobalPlaysRoute() {
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect('/');

  const projects = await listProjects();
  const tracked = projects.filter((p) => resolveSiteSlug(p.id));
  const [mode, tasks, followups, platforms, media, teamMembers, proxies, browserProfiles, sourceIntel, browserReady, products, ...acctLists] = await Promise.all([
    getMode('affiliate'),
    getAllBacklinkTasks(projects),
    listFollowups(),
    listPlatforms(),
    listMedia(),
    listTeamMembers(),
    listProxies(),
    listBrowserProfiles(),
    listSourceIntel(),
    listProjectsWithBrowser(),
    listBuildingProducts(),
    ...tracked.map((p) => listAccounts(p.id)),
  ]);
  // Backlink accounts are tenant-shared → union the per-project lists, dedupe by id.
  const accounts = Array.from(new Map(acctLists.flat().map((a) => [a.id, a])).values());
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));

  return (
    <AppShell
      mode={mode}
      projects={projects}
      isPortfolio
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
    >
      <BacklinksPage prefs={prefs} allProjects products={products} projectsById={projectsById}
        projectId="" slug={null} siteLabel="All projects" tasks={tasks} followups={followups}
        project={(tracked[0] ?? projects[0])!} platforms={platforms} accounts={accounts}
        teamMembers={teamMembers} proxies={proxies} browserProfiles={browserProfiles} media={media} sourceIntel={sourceIntel} browserReady={browserReady} initialView="kanban" />
    </AppShell>
  );
}
