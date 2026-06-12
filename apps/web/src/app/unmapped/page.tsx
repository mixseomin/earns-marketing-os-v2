import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { UnmappedPage } from '@/components/unmapped-page';
import { listProjects, listUnmappedAccounts, getMode, getProjectMode } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function UnmappedRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/unmapped');
  if (me.role !== 'admin') redirect('/?error=admin-only');

  const [projects, accounts, lastProject, fallbackMode] = await Promise.all([
    listProjects(),
    listUnmappedAccounts(),
    getLastProject(),
    getMode('affiliate'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <UnmappedPage
        accounts={accounts}
        projects={projects.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))}
      />
    </AppShell>
  );
}
