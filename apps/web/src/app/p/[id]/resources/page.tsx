import { notFound, redirect } from 'next/navigation';
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
import { listProxies, listBrowserProfiles } from '@/lib/actions/environments';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';
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

  // eff = operator identity when admin is impersonating, otherwise real user
  const [, eff] = await Promise.all([getCurrentUser(), getEffectiveUser()]);
  const isOperator = eff?.role !== 'admin';

  const [mode, projects, platforms, accounts, knowledge, contacts, media, infra, budget, teamMembers, impCtx, visData, proxies, browserProfiles] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listPlatforms(),
    listAccounts(id),
    // Only fetch non-account vaults if operator has visibility or is admin
    isDemo ? Promise.resolve([]) : listKnowledge(id),
    isDemo ? Promise.resolve([]) : listContacts(id),
    isDemo ? Promise.resolve([]) : listMedia(id),
    isDemo ? Promise.resolve([]) : listInfra(id),
    isDemo ? Promise.resolve([]) : listBudget(id),
    // Team members only for admin (not when impersonating operator)
    isOperator ? Promise.resolve([]) : listTeamMembers(),
    getImpersonateContext(),
    isOperator && eff ? getEffectiveVisibility(eff.id) : Promise.resolve(null),
    // Proxy + browser profile lists for account modal "Environment" linking
    isDemo ? Promise.resolve([]) : listProxies(),
    isDemo ? Promise.resolve([]) : listBrowserProfiles(),
  ]);

  const vis = visData?.config ?? null;
  // Visibility gates — operators use their config, admins see everything
  const canSeeAccounts  = isOperator ? (vis?.resources?.accounts  ?? false) : true;
  const canSeeMedia     = isOperator ? (vis?.resources?.media     ?? false) : true;
  const canSeeContacts  = isOperator ? (vis?.resources?.contacts  ?? false) : true;
  const canSeeInfra     = isOperator ? (vis?.resources?.infra     ?? false) : true;
  const canSeeBudget    = isOperator ? (vis?.resources?.budget    ?? false) : true;
  const canSeeKnowledge = isOperator ? (vis?.resources?.knowledge ?? false) : true;

  // Operator with no assigned accounts AND no vault visibility → redirect to inbox
  if (isOperator) {
    const hasAnyVault = canSeeAccounts || canSeeMedia || canSeeContacts || canSeeInfra || canSeeBudget || canSeeKnowledge;
    const hasAssignedAccounts = accounts.length > 0;
    if (!hasAnyVault && !hasAssignedAccounts) {
      redirect(`/p/${id}/inbox`);
    }
  }

  const vaultStats: Record<string, string> | undefined = isDemo ? undefined : {
    accounts: `${accounts.filter((a) => a.status === 'active').length}/${accounts.length} active`,
    media:    canSeeMedia     ? (media.length    === 0 ? 'empty' : `${media.length} files · ${fmtSize(media.reduce((s, m) => s + m.sizeBytes, 0))}`) : 'restricted',
    contacts: canSeeContacts  ? (contacts.length === 0 ? 'empty' : `${contacts.length} contacts`)   : 'restricted',
    infra:    canSeeInfra     ? (infra.length    === 0 ? 'empty' : `${infra.filter((i) => i.status === 'active').length}/${infra.length} active`) : 'restricted',
    budget:   canSeeBudget    ? (budget.length   === 0 ? 'empty' : `${budget.length} entries`)       : 'restricted',
    knowledge:canSeeKnowledge ? (knowledge.length=== 0 ? 'empty' : `${knowledge.length} items`)      : 'restricted',
  };

  return (
    <AppShell
      mode={mode} project={project} projects={projects} tab="resources"
      currentUser={eff ? { id: eff.id, displayName: eff.displayName, email: eff.email, role: eff.role, specialty: eff.specialty } : undefined}
      impersonate={impCtx?.active ? { targetUserId: impCtx.targetUserId, targetName: impCtx.targetName, targetRole: impCtx.targetRole, config: impCtx.config } : null}
      configVersion={visData?.configVersion}
    >
      <ResourcesPage
        isBlank={!isDemo}
        vaultStats={vaultStats}
        isAdmin={!isOperator}
        accountsOverride={
          <AccountsVault projectId={id} project={project} platforms={platforms} accounts={accounts} teamMembers={teamMembers} proxies={proxies} browserProfiles={browserProfiles} isAdmin={!isOperator} />
        }
        knowledgeOverride={canSeeKnowledge ? (isDemo ? undefined : <KnowledgeVault items={knowledge} projectName={project.name} projectId={id} />) : <></>}
        contactsOverride ={canSeeContacts  ? (isDemo ? undefined : <ContactsVault  contacts={contacts} projectName={project.name} />) : <></>}
        mediaOverride    ={canSeeMedia     ? (isDemo ? undefined : <MediaVault     items={media} projectId={id} />) : <></>}
        infraOverride    ={canSeeInfra     ? (isDemo ? undefined : <InfraVault     items={infra} projectId={id} />) : <></>}
        budgetOverride   ={canSeeBudget    ? (isDemo ? undefined : <BudgetVault    items={budget} projectId={id} />) : <></>}
      />
    </AppShell>
  );
}
