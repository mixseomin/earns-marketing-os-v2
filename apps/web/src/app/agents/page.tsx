import { AppShell } from '@/components/app-shell';
import { AgentsAdminPage } from '@/components/agents-admin-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import {
  listAgentKindStats, listRecentAgentRuns, listReasoningSquads, getSystemFlags,
} from '@/lib/actions/agents-admin';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function AgentsRoute() {
  const [projects, lastProject, fallbackMode, kindStats, recentRuns, reasoningSquads, flags] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listAgentKindStats(),
    listRecentAgentRuns(50),
    listReasoningSquads(),
    getSystemFlags(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <AgentsAdminPage
        kindStats={kindStats}
        recentRuns={recentRuns}
        reasoningSquads={reasoningSquads}
        flags={flags}
      />
    </AppShell>
  );
}
