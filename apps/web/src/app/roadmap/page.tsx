import { AppShell } from '@/components/app-shell';
import { RoadmapPage } from '@/components/roadmap-page';
import { listProjects, listRoadmap, getMode } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function RoadmapRoute() {
  const [projects, items, mode] = await Promise.all([
    listProjects(),
    listRoadmap(),
    getMode('affiliate'),
  ]);

  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <RoadmapPage items={items} />
    </AppShell>
  );
}
