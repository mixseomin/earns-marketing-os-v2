import { AppShell } from '@/components/app-shell';
import { NewProjectForm } from '@/components/new-project-form';
import { listProjects, listModes, getMode } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function NewProjectRoute() {
  const [projects, allModes, mode] = await Promise.all([
    listProjects(),
    listModes(),
    getMode('affiliate'),
  ]);

  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <NewProjectForm allModes={allModes} />
    </AppShell>
  );
}
