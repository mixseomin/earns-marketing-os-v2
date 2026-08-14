import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
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
  // Nhóm cột nào đang bật: đọc COOKIE ngay trên server để lần sơn ĐẦU TIÊN đã đúng. Không có bước
  // này thì trang dựng bằng mặc định rồi localStorage mới sửa lại ở client — đúng cái nháy khi F5.
  const raw = (await cookies()).get('communities')?.value;
  let initialShown: Record<string, boolean> | undefined;
  try { initialShown = raw ? JSON.parse(decodeURIComponent(raw)) : undefined; } catch { initialShown = undefined; }

  return (
    <AppShell
      mode={mode}
      projects={projects}
      isPortfolio
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
    >
      {/* tribes=[] — tribe assignment stays in /tribes; the modal tolerates an empty picker. */}
      <CommunitiesVault projectId={project || undefined} rows={communities} platforms={platforms} projects={projOpts} tribes={[]} gatedKeys={gated} initialShown={initialShown} />
    </AppShell>
  );
}
