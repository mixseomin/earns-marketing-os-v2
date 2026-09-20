import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BacklinksPage } from '@/components/backlinks-page';
import { listHangMuc } from '@/lib/tien-do';
import { getMode, listProjects, listPlatforms, listAccounts, listMedia } from '@/lib/data';
import { listTeamMembers } from '@/lib/actions/team';
import { listProxies, listBrowserProfiles, listProjectsWithBrowser } from '@/lib/actions/environments';
import { getCurrentUser } from '@/lib/auth';
import { listBuildingProducts } from '@/lib/actions/products-building';
import { getAllBacklinkTasks } from '@/lib/actions/backlink-tasks';
import { listFollowups } from '@/lib/actions/followups';
import { listScheduledContentPieces } from '@/lib/data';
import { listSourceIntel } from '@/lib/actions/backlink-catalog';
import { PREFS_COOKIE, parsePrefs } from '@/lib/prefs';
import { todayInAppTz } from '@/lib/local-day';
import { resolveSiteSlug } from '@/lib/backlink-sites';

export const dynamic = 'force-dynamic';

// Global "Plays" — every backlink-tracked project's plays in ONE surface. Reuses BacklinksPage whole in
// allProjects mode (same list / Kanban / Calendar / task drawer); each row carries its own project so
// status changes + the drawer act on the right site. Per-project actions (Seed/Generate/account-readiness)
// are hidden here — those stay on /p/[id]/plays. See getAllBacklinkTasks.
export default async function GlobalPlaysRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect('/');

  // View 📈 Tiến độ KHÔNG dùng payload plays (task/bài/account/media của mọi project ≈ 3,9 MB HTML) — trước
  // đây vẫn kéo hết nên mở sổ tiến độ là ngồi nhìn skeleton (anh chửi 20/09/2026). Cùng thứ tự chọn view như
  // client (URL → cookie prefs): là tiendo thì chỉ nạp phần sổ + khung; rời view này là tải lại trang đủ.
  const lite = (typeof sp.view === 'string' ? sp.view : prefs['plays.view']) === 'tiendo';
  const projects = await listProjects();
  const [mode, tasks, followups, pieces, platforms, media, teamMembers, proxies, browserProfiles, sourceIntel, browserReady, products, accounts, tienDo] = await Promise.all([
    getMode('affiliate'),
    lite ? [] : getAllBacklinkTasks(projects),
    lite ? [] : listFollowups(),
    lite ? [] : listScheduledContentPieces(),
    listPlatforms(),
    lite ? [] : listMedia(),
    listTeamMembers(),
    lite ? [] : listProxies(),
    lite ? [] : listBrowserProfiles(),
    lite ? {} : listSourceIntel(),
    lite ? [] : listProjectsWithBrowser(),
    lite ? [] : listBuildingProducts(),
    lite ? [] : listAccounts(),   // MỌI account của tenant: lịch mang việc + bài của mọi project, không riêng site backlink
    listHangMuc().catch(() => []),
  ]);
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));

  return (
    <AppShell
      mode={mode}
      projects={projects}
      isPortfolio
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
    >
      <BacklinksPage prefs={prefs} today={todayInAppTz()} allProjects products={products} projectsById={projectsById}
        projectId="" slug={null} siteLabel="All projects" tasks={tasks} followups={followups} pieces={pieces}
        project={(projects.find((p) => resolveSiteSlug(p.id)) ?? projects[0])!} platforms={platforms} accounts={accounts}
        teamMembers={teamMembers} proxies={proxies} browserProfiles={browserProfiles} media={media} sourceIntel={sourceIntel} browserReady={browserReady} initialView="kanban" tienDo={tienDo} lite={lite} />
    </AppShell>
  );
}
