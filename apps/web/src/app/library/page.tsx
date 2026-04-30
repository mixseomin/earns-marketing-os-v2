import { AppShell } from '@/components/app-shell';
import { LibraryPage } from '@/components/library-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listTools, listSkills } from '@/lib/actions/library';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function LibraryRoute() {
  const [projects, tools, skills, lastProject, fallbackMode] = await Promise.all([
    listProjects(),
    listTools(),
    listSkills(),
    getLastProject(),
    getMode('affiliate'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <LibraryPage tools={tools} skills={skills} />
    </AppShell>
  );
}
