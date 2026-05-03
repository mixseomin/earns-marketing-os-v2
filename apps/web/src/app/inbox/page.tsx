import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { InboxPage } from '@/components/inbox-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listInbox } from '@/lib/actions/inbox';
import { listTeamMembers } from '@/lib/actions/team';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';
import { getImpersonateContext } from '@/lib/actions/impersonate';
import { getEffectiveVisibility } from '@/lib/actions/visibility';

export const dynamic = 'force-dynamic';

export default async function InboxRoute({ searchParams }: { searchParams: Promise<{ assign?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/inbox');

  // Effective user: operator identity when admin is impersonating
  const eff = await getEffectiveUser();
  const params = await searchParams;
  const assignParam = params.assign;
  const assignment: 'all' | 'mine' | 'unassigned' | number =
    eff!.role === 'operator' ? 'mine' :
    assignParam === 'mine' ? 'mine' :
    assignParam === 'unassigned' ? 'unassigned' :
    assignParam && !isNaN(Number(assignParam)) ? Number(assignParam) :
    'all';

  const [projects, lastProject, fallbackMode, tasks, teamMembers, impCtx, visData] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listInbox('all', undefined, { assignment, currentUserId: eff!.id }),
    eff!.role === 'admin' ? listTeamMembers() : Promise.resolve([]),
    getImpersonateContext(),
    eff!.role !== 'admin' ? getEffectiveVisibility(eff!.id) : Promise.resolve(null),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: eff!.id, displayName: eff!.displayName, email: eff!.email, role: eff!.role, specialty: eff!.specialty }}
      impersonate={impCtx?.active ? { targetUserId: impCtx.targetUserId, targetName: impCtx.targetName, targetRole: impCtx.targetRole, config: impCtx.config } : null}
      configVersion={visData?.configVersion}>
      <InboxPage tasks={tasks} teamMembers={teamMembers} currentUserId={eff!.id} />
    </AppShell>
  );
}
