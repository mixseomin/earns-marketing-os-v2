import { AppShell } from '@/components/app-shell';
import { AILogPage } from '@/components/ai-log-page';
import { listProjects, getMode } from '@/lib/data';
import { listAILog, getDailyTokenUsage } from '@/lib/actions/ai-suggestions';

export const dynamic = 'force-dynamic';

export default async function AILogRoute() {
  const [projects, log, dailyUsage, mode] = await Promise.all([
    listProjects(),
    listAILog(200),
    getDailyTokenUsage(),
    getMode('affiliate'),
  ]);

  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <AILogPage log={log} dailyUsage={dailyUsage} />
    </AppShell>
  );
}
