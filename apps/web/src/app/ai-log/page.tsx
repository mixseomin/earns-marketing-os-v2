import { AppShell } from '@/components/app-shell';
import { AILogPage } from '@/components/ai-log-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listAILog, getDailyTokenUsage } from '@/lib/actions/ai-suggestions';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function AILogRoute() {
  const [projects, log, dailyUsage, lastProject, fallbackMode] = await Promise.all([
    listProjects(),
    listAILog(200),
    getDailyTokenUsage(),
    getLastProject(),
    getMode('affiliate'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <AILogPage log={log} dailyUsage={dailyUsage} />
    </AppShell>
  );
}
