import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ServersPage } from '@/components/servers-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';
import { SERVER_BOXES } from '@/lib/servers';

export const dynamic = 'force-dynamic';

// Fleet inventory of the physical boxes behind the portfolio (specs · usage · cost · sites).
// Admin-only, same gate/shell as /environments. Data = lib/servers.ts (snapshot config).
export default async function ServersRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/servers');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <ServersPage boxes={SERVER_BOXES} />
    </AppShell>
  );
}
