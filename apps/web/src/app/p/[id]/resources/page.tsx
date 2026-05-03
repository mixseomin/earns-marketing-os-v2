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
import { listTeamMembers } from '@/lib/actions/team';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function fmtSize(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)}MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

export default async function ResourcesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const isDemo = project.isDemo === true;

  const me = await getCurrentUser();
  const [mode, projects, platforms, accounts, knowledge, contacts, media, infra, budget, teamMembers] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listPlatforms(),
    listAccounts(id),
    isDemo ? Promise.resolve([]) : listKnowledge(id),
    isDemo ? Promise.resolve([]) : listContacts(id),
    isDemo ? Promise.resolve([]) : listMedia(id),
    isDemo ? Promise.resolve([]) : listInfra(id),
    isDemo ? Promise.resolve([]) : listBudget(id),
    me?.role === 'admin' ? listTeamMembers() : Promise.resolve([]),
  ]);

  // Real-count subs cho VAULT_NAV — replaces mock "247 nick / 50tr/d cap" etc.
  // Demo projects giữ mock sub vì không có DB data → undefined skips override.
  const vaultStats: Record<string, string> | undefined = isDemo ? undefined : {
    accounts: `${accounts.filter((a) => a.status === 'active').length}/${accounts.length} active`,
    media: media.length === 0 ? 'empty' : `${media.length} files · ${fmtSize(media.reduce((s, m) => s + m.sizeBytes, 0))}`,
    contacts: contacts.length === 0 ? 'empty' : `${contacts.length} contacts`,
    infra: infra.length === 0 ? 'empty' : `${infra.filter((i) => i.status === 'active').length}/${infra.length} active`,
    budget: budget.length === 0 ? 'empty' : `${budget.length} entries`,
    knowledge: knowledge.length === 0 ? 'empty' : `${knowledge.length} items`,
  };

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="resources">
      <ResourcesPage
        isBlank={!isDemo}
        vaultStats={vaultStats}
        accountsOverride={
          <AccountsVault projectId={id} project={project} platforms={platforms} accounts={accounts} teamMembers={teamMembers} />
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
