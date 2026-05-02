import { AppShell } from '@/components/app-shell';
import { TeamPage } from '@/components/team-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listTeamMembers, getCurrentUserId } from '@/lib/actions/team';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function TeamRoute() {
  const [projects, lastProject, fallbackMode, members, currentUserId] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listTeamMembers(),
    getCurrentUserId(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <TeamPage members={members} currentUserId={currentUserId} />
    </AppShell>
  );
}
