import { AppShell } from '@/components/app-shell';
import { LibraryPage } from '@/components/library-page';
import { listProjects, getMode } from '@/lib/data';
import { listTools, listSkills } from '@/lib/actions/library';

export const dynamic = 'force-dynamic';

export default async function LibraryRoute() {
  const [projects, tools, skills, mode] = await Promise.all([
    listProjects(),
    listTools(),
    listSkills(),
    getMode('affiliate'),
  ]);

  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <LibraryPage tools={tools} skills={skills} />
    </AppShell>
  );
}
