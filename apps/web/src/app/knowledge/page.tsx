import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { KnowledgeCatalogPage } from '@/components/knowledge-catalog-page';
import { listProjects, getMode, getProjectMode, listSharedKnowledge } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function KnowledgeRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/knowledge');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, items] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listSharedKnowledge(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio>
      <KnowledgeCatalogPage items={items} projects={projects.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))} />
    </AppShell>
  );
}
