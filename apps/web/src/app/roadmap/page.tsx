import { AppShell } from '@/components/app-shell';
import { RoadmapPage } from '@/components/roadmap-page';
import { listProjects, listRoadmap, getMode, getProjectMode } from '@/lib/data';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function RoadmapRoute() {
  const [projects, items, lastProject, fallbackMode] = await Promise.all([
    listProjects(),
    listRoadmap(),
    getLastProject(),
    getMode('affiliate'),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <RoadmapPage items={items} />
    </AppShell>
  );
}
