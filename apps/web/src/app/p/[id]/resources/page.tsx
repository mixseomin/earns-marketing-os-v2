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
import { getImpersonateContext } from '@/lib/actions/impersonate';
import { getEffectiveVisibility } from '@/lib/actions/visibility';

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
  const [mode, projects, platforms, accounts, knowledge, contacts, media, infra, budget, teamMembers, impCtx, visData] = await Promise.all([
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
    getImpersonateContext(),
    me && me.role !== 'admin' ? getEffectiveVisibility(me.id) : Promise.resolve(null),
  ]);
  // Use visibility config for non-admin users (or impersonate target)
  const vis = visData?.config ?? null;

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

  const isOperator = me?.role !== 'admin';
  // Visibility-gated: use vis config for non-admins, otherwise show all
  const canSeeKnowledge = isOperator ? (vis?.resources?.knowledge ?? false) : true;
  const canSeeContacts = isOperator ? (vis?.resources?.contacts ?? false) : true;
  const canSeeMedia = isOperator ? (vis?.resources?.media ?? false) : true;
  const canSeeInfra = isOperator ? (vis?.resources?.infra ?? false) : true;
  const canSeeBudget = isOperator ? (vis?.resources?.budget ?? false) : true;

  return (
    <AppShell
      mode={mode}
      project={project}
      projects={projects}
      tab="resources"
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
      impersonate={impCtx?.active ? { targetUserId: impCtx.targetUserId, targetName: impCtx.targetName, targetRole: impCtx.targetRole, config: impCtx.config } : null}
      configVersion={visData?.configVersion}
    >
      <ResourcesPage
        isBlank={!isDemo}
        vaultStats={vaultStats}
        accountsOverride={
          <AccountsVault projectId={id} project={project} platforms={platforms} accounts={accounts} teamMembers={teamMembers} />
        }
        knowledgeOverride={canSeeKnowledge ? (isDemo ? undefined : <KnowledgeVault items={knowledge} projectName={project.name} />) : <></>}
        contactsOverride={canSeeContacts ? (isDemo ? undefined : <ContactsVault contacts={contacts} projectName={project.name} />) : <></>}
        mediaOverride={canSeeMedia ? (isDemo ? undefined : <MediaVault items={media} projectId={id} />) : <></>}
        infraOverride={canSeeInfra ? (isDemo ? undefined : <InfraVault items={infra} projectId={id} />) : <></>}
        budgetOverride={canSeeBudget ? (isDemo ? undefined : <BudgetVault items={budget} projectId={id} />) : <></>}
      />
    </AppShell>
  );
}
