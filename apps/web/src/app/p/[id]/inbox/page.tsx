import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { InboxPage } from '@/components/inbox-page';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listInbox } from '@/lib/actions/inbox';
import { listTeamMembers } from '@/lib/actions/team';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';
import { getImpersonateContext } from '@/lib/actions/impersonate';
import { getEffectiveVisibility } from '@/lib/actions/visibility';

export const dynamic = 'force-dynamic';

export default async function ProjectInboxRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assign?: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/inbox`);

  // Effective user: operator identity when admin is impersonating
  const eff = await getEffectiveUser();

  const sp = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  const assignment: 'all' | 'mine' | 'unassigned' | number =
    eff!.role === 'operator' ? 'mine' :
    sp.assign === 'mine' ? 'mine' :
    sp.assign === 'unassigned' ? 'unassigned' :
    sp.assign && !isNaN(Number(sp.assign)) ? Number(sp.assign) :
    'all';

  const [mode, projects, tasks, teamMembers, impCtx, visData] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listInbox('all', id, { assignment, currentUserId: eff!.id }),
    // Only load team list when truly admin (not impersonating) — operators never see others
    eff!.role === 'admin' ? listTeamMembers() : Promise.resolve([]),
    getImpersonateContext(),
    eff!.role !== 'admin' ? getEffectiveVisibility(eff!.id) : Promise.resolve(null),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects}
      currentUser={{ id: eff!.id, displayName: eff!.displayName, email: eff!.email, role: eff!.role, specialty: eff!.specialty }}
      impersonate={impCtx?.active ? { targetUserId: impCtx.targetUserId, targetName: impCtx.targetName, targetRole: impCtx.targetRole, config: impCtx.config } : null}
      configVersion={visData?.configVersion}
    >
      <InboxPage tasks={tasks} teamMembers={teamMembers} currentUserId={eff!.id} currentUserRole={eff!.role} projectId={id} />
    </AppShell>
  );
}
