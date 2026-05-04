import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CommandBoard } from '@/components/board';
import { getProject, getProjectMode, listProjects } from "@/lib/data";
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';
import { getImpersonateContext } from '@/lib/actions/impersonate';

export const dynamic = 'force-dynamic';

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/board`);

  const [eff, project, impCtx] = await Promise.all([
    getEffectiveUser(),
    getProject(id),
    getImpersonateContext(),
  ]);
  if (!project) notFound();
  const [mode, projects] = await Promise.all([getProjectMode(id, project.mode), listProjects()]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="board"
      currentUser={{ id: eff!.id, displayName: eff!.displayName, email: eff!.email, role: eff!.role, specialty: eff!.specialty }}
      impersonate={impCtx?.active ? { targetUserId: impCtx.targetUserId, targetName: impCtx.targetName, targetRole: impCtx.targetRole, config: impCtx.config } : null}>
      <CommandBoard mode={mode} projectId={id} />
    </AppShell>
  );
}
