import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ResourcesPage } from '@/components/resources-page';
import { AccountsVault } from '@/components/accounts-vault';
import { KnowledgeVault } from '@/components/knowledge-vault';
import { ContactsVault } from '@/components/contacts-vault';
import { getProject, getProjectMode, listProjects, listPlatforms, listAccounts, listKnowledge, listContacts } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function ResourcesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const isDemo = project.isDemo === true;

  const [mode, projects, platforms, accounts, knowledge, contacts] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listPlatforms(),
    listAccounts(id),
    isDemo ? Promise.resolve([]) : listKnowledge(id),
    isDemo ? Promise.resolve([]) : listContacts(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="resources">
      <ResourcesPage
        isBlank={!isDemo}
        accountsOverride={
          <AccountsVault projectId={id} project={project} platforms={platforms} accounts={accounts} />
        }
        knowledgeOverride={
          isDemo ? undefined : <KnowledgeVault items={knowledge} projectName={project.name} />
        }
        contactsOverride={
          isDemo ? undefined : <ContactsVault contacts={contacts} projectName={project.name} />
        }
      />
    </AppShell>
  );
}
