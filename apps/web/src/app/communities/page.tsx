import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CommunitiesVault } from '@/components/communities-vault';
import { getMode, listProjects, listPlatforms } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { listCommunities, gatedPlatformKeys } from '@/lib/actions/communities';

export const dynamic = 'force-dynamic';

// Global Communities registry — every habitat (subreddit/forum) across projects in one
// vault with rules · link-gate · standing. ?project=<id> filters to one site (the
// per-project view). Admin-only, portfolio surface (like /plays).
export default async function CommunitiesRoute({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect('/');
  const { project } = await searchParams;

  const [mode, projects, platforms, communities, gated] = await Promise.all([
    getMode('affiliate'),
    listProjects(),
    listPlatforms(),
    listCommunities(project || undefined),
    gatedPlatformKeys(),
  ]);
  const projOpts = projects.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji ?? null }));
  return (
    <AppShell
      mode={mode}
      projects={projects}
      isPortfolio
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
    >
      {/* tribes=[] — tribe assignment stays in /tribes; the modal tolerates an empty picker. */}
      <CommunitiesVault projectId={project || undefined} rows={communities} platforms={platforms} projects={projOpts} tribes={[]} gatedKeys={gated} />
    </AppShell>
  );
}
