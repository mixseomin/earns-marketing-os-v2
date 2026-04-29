import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ResourcesPage } from '@/components/resources-page';
import { AccountsVault } from '@/components/accounts-vault';
import { getProject, getProjectMode, listProjects, listPlatforms, listAccounts } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function ResourcesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects, platforms, accounts] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listPlatforms(),
    listAccounts(id),
  ]);

  // Same blank-detection heuristic as Dashboard: project has no squads + no
  // cards = "blank slate", suppress mock data leaks in non-Accounts vaults.
  const isBlank = mode.squads.length === 0 && mode.cards.length === 0;

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="resources">
      <ResourcesPage
        isBlank={isBlank}
        accountsOverride={
          <AccountsVault projectId={id} project={project} platforms={platforms} accounts={accounts} />
        }
      />
    </AppShell>
  );
}
