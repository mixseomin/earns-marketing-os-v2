import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';
import { SettingsIndex } from '@/components/settings-index';

export const dynamic = 'force-dynamic';

export default async function SettingsRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/settings');
  if (me.role !== 'admin') redirect('/?error=admin-only');

  const [projects, lastProject, fallbackMode] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;
  const extKey = process.env.MOS2_EXT_KEY ?? '';

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <SettingsIndex extKey={extKey} />
    </AppShell>
  );
}
