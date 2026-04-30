import { AppShell } from '@/components/app-shell';
import { ApiSettingsPage } from '@/components/api-settings-page';
import { listProjects, getMode } from '@/lib/data';
import { getProviderStatuses } from '@/lib/ai-providers';

export const dynamic = 'force-dynamic';

export default async function ApiSettingsRoute() {
  const [projects, mode] = await Promise.all([
    listProjects(),
    getMode('affiliate'),
  ]);
  const providers = getProviderStatuses();

  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <ApiSettingsPage providers={providers} />
    </AppShell>
  );
}
