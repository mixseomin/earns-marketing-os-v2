import { AppShell } from '@/components/app-shell';
import { ApiSettingsPage } from '@/components/api-settings-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getProviderStatuses } from '@/lib/ai-providers';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function ApiSettingsRoute() {
  const [projects, lastProject, fallbackMode] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;
  const providers = getProviderStatuses();

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <ApiSettingsPage providers={providers} />
    </AppShell>
  );
}
