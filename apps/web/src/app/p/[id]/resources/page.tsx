import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ResourcesPage } from '@/components/resources-page';
import { AccountsVault } from '@/components/accounts-vault';
import { KnowledgeVault } from '@/components/knowledge-vault';
import { ContactsVault } from '@/components/contacts-vault';
import { MediaVault } from '@/components/media-vault';
import { InfraVault } from '@/components/infra-vault';
import { BudgetVault } from '@/components/budget-vault';
import { getProject, getProjectMode, listProjects, listPlatforms, listAccounts, listKnowledge, listContacts, listMedia, listInfra, listBudget } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function ResourcesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const isDemo = project.isDemo === true;

  const [mode, projects, platforms, accounts, knowledge, contacts, media, infra, budget] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listPlatforms(),
    listAccounts(id),
    isDemo ? Promise.resolve([]) : listKnowledge(id),
    isDemo ? Promise.resolve([]) : listContacts(id),
    isDemo ? Promise.resolve([]) : listMedia(id),
    isDemo ? Promise.resolve([]) : listInfra(id),
    isDemo ? Promise.resolve([]) : listBudget(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="resources">
      <ResourcesPage
        isBlank={!isDemo}
        accountsOverride={
          <AccountsVault projectId={id} project={project} platforms={platforms} accounts={accounts} />
        }
        knowledgeOverride={isDemo ? undefined : <KnowledgeVault items={knowledge} projectName={project.name} />}
        contactsOverride={isDemo ? undefined : <ContactsVault contacts={contacts} projectName={project.name} />}
        mediaOverride={isDemo ? undefined : <MediaVault items={media} projectId={id} />}
        infraOverride={isDemo ? undefined : <InfraVault items={infra} projectId={id} />}
        budgetOverride={isDemo ? undefined : <BudgetVault items={budget} projectId={id} />}
      />
    </AppShell>
  );
}
