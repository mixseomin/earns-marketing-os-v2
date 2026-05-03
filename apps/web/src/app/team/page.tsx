import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { TeamPage } from '@/components/team-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listTeamMembers } from '@/lib/actions/team';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function TeamRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/team');
  if (me.role !== 'admin') redirect('/?error=team-admin-only');

  const [projects, lastProject, fallbackMode, members] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listTeamMembers(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <TeamPage members={members} currentUserId={me.id} currentRole={me.role} />
    </AppShell>
  );
}
